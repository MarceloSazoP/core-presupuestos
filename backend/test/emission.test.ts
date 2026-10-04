import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { config } from '../src/config';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let b: { token: string; user: { id: string } };

const root = () => process.env.STORAGE_DIR!;
const filesOnDisk = (dir = join(root(), 'u')): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesOnDisk(join(dir, e.name)) : [join(dir, e.name)])) : [];
// PNG real de 1×1 (pdfmake lo decodifica de verdad); PNG_FALSO solo tiene la firma de bytes.
const PNG = () => Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PNG_FALSO = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(80, 2)]);
const year = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric' }).format(new Date());

describe('API: finalizar, vista pública y envíos (Contrato API §7, §10 y §14)', () => {
  before(async () => {
    await assertTestDb();
    await migrate(pool);
  });
  after(async () => {
    await resetDb();
    await pool.end();
  });
  beforeEach(async () => {
    await resetDb();
    for (const d of ['u', 'tmp']) rmSync(join(root(), d), { recursive: true, force: true });
    app = await startApp();
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
    b = await app.login('+56922222222', 'b@test.cl', 'Beto');
  });
  afterEach(async () => {
    await app.close();
  });

  // Presupuesto completo y listo para finalizar.
  const completo = async (token = a.token, o: { customer?: object; patch?: object } = {}) => {
    const q = (await app.api('POST', '/quotes', { token, body: { customer: o.customer ?? { name: 'Juan Pérez', phone: '+56933333333', email: 'juan@cliente.cl' }, address: 'Av. X 1234' } })).json;
    await app.api('PATCH', `/quotes/${q.id}`, { token, body: { service_description: 'Instalación eléctrica', validity_days: 15, warranty: { kind: 'M3' }, observations: 'Pago contra entrega', ...o.patch } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token, body: { items: [{ description: 'Piso', quantity: 12.5, unit: 'm2', unit_price: 18000 }, { description: 'Mano de obra', quantity: 8, unit: 'hh', unit_price: 5000 }] } });
    await app.api('PUT', `/quotes/${q.id}/survey`, { token, body: { notes: 'NOTA INTERNA SECRETA', field_observations: 'OBSERVACION INTERNA' } });
    return q as { id: string; access_code: string };
  };
  const finalizar = (id: string, token = a.token) => app.api('POST', `/quotes/${id}/finalize`, { token, body: {} });
  const tokenOf = async (id: string) => (await pool.query('SELECT token FROM quote_access WHERE quote_id = $1 AND kind = \'PUBLIC\'', [id])).rows[0]?.token as string;
  const count = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows[0].n as number;

  it('un presupuesto incompleto responde 422 con todos los problemas y no deja nada a medias', async () => {
    const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json;
    const r = await finalizar(q.id);
    assert.equal(r.status, 422);
    assert.deepEqual(r.json.error.details.map((d: { field: string }) => d.field).sort(), ['items', 'service_description', 'validity_days']);
    assert.equal(await count('SELECT count(*)::int AS n FROM quote_documents'), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM files WHERE kind = 'PDF'`), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM quote_counters'), 0, 'no se gastó un número');
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.doc_status, 'DRAFT');
  });

  it('valida el descuento y la firma', async () => {
    const q = await completo(a.token, { patch: { discount: 999_999 } });
    const r = await finalizar(q.id);
    assert.equal(r.status, 422);
    assert.deepEqual(r.json.error.details.map((d: { field: string }) => d.field), ['discount']);
    await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { discount: 0, include_signature: true } });
    assert.deepEqual((await finalizar(q.id)).json.error.details.map((d: { field: string }) => d.field), ['include_signature']);
    assert.equal((await app.upload('PUT', '/me/signature', { token: a.token, file: PNG() })).status, 200);
    assert.equal((await finalizar(q.id)).status, 200, 'con la firma subida sí');
  });

  it('finaliza: número CP-AAAA-NNNN por usuario, snapshot sin datos internos, PDF y enlace público', async () => {
    const q = await completo();
    const r = await finalizar(q.id);
    assert.equal(r.status, 200);
    assert.equal(r.json.doc_status, 'FINALIZED');
    assert.equal(r.json.commercial_status, 'NONE', 'finalizar no es enviar');
    assert.equal(r.json.number, `CP-${year()}-0001`);
    const token = await tokenOf(q.id);
    assert.equal(r.json.public_url, `${config.WEB_BASE_URL}/q/${token}`);
    assert.ok(token.length >= 32, '192 bits en base64url');

    const { rows } = await pool.query('SELECT snapshot, pdf_file_id FROM quote_documents WHERE quote_id = $1', [q.id]);
    const s = rows[0].snapshot;
    assert.equal(s.total, 265000);
    assert.equal(s.warranty.text, '3 meses');
    assert.deepEqual(s.customer, { name: 'Juan Pérez' }, 'sin teléfono ni correo del cliente');
    const texto = JSON.stringify(s);
    for (const prohibido of ['NOTA INTERNA', 'OBSERVACION INTERNA', 'short_id', a.user.id, 'juan@cliente.cl', '+56933333333']) assert.ok(!texto.includes(prohibido), `el snapshot no debe contener ${prohibido}`);
    const pdf = readFileSync(filesOnDisk().find((f) => f.endsWith('.pdf'))!);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 1000);

    const q2 = await completo();
    assert.equal((await finalizar(q2.id)).json.number, `CP-${year()}-0002`);
    const qb = await completo(b.token);
    assert.equal((await finalizar(qb.id, b.token)).json.number, `CP-${year()}-0001`, 'la numeración es por usuario');
  });

  it('un FINALIZED no se vuelve a finalizar ni a editar', async () => {
    const q = await completo();
    await finalizar(q.id);
    assert.equal((await finalizar(q.id)).status, 409);
    for (const [m, p, body] of [['PATCH', '', { address: 'x' }], ['PUT', '/items', { items: [] }], ['POST', '/save', {}], ['DELETE', '', undefined]] as [string, string, object?][]) {
      assert.equal((await app.api(m, `/quotes/${q.id}${p}`, { token: a.token, ...(body && { body }) })).status, 409, `${m} ${p}`);
    }
  });

  it('dos "terminar" simultáneos: uno gana y el otro recibe 409; un solo número y un solo PDF', async () => {
    const q = await completo();
    const rs = await Promise.all([finalizar(q.id), finalizar(q.id), finalizar(q.id)]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
    assert.equal(await count('SELECT last_number AS n FROM quote_counters'), 1);
    assert.equal(await count(`SELECT count(*)::int AS n FROM files WHERE kind = 'PDF'`), 1);
    assert.equal(filesOnDisk().filter((f) => f.endsWith('.pdf')).length, 1);
  });

  it('si algo falla a mitad, se revierte todo: sin PDF suelto, sin número gastado, sigue editable', async () => {
    const q = await completo();
    // Un enlace público previo hace fallar el INSERT final, DESPUÉS de haber escrito el PDF.
    await pool.query(`INSERT INTO quote_access (quote_id, kind, token) VALUES ($1, 'PUBLIC', 'preexistente')`, [q.id]);
    const r = await finalizar(q.id);
    assert.equal(r.status, 500);
    assert.equal(r.json.error.code, 'INTERNAL');
    assert.deepEqual(filesOnDisk().filter((f) => f.endsWith('.pdf')), [], 'el PDF escrito se borró');
    assert.equal(await count('SELECT count(*)::int AS n FROM quote_counters'), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM quote_documents'), 0);
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.doc_status, 'DRAFT');
    await pool.query('DELETE FROM quote_access WHERE token = $1', ['preexistente']);
    const ok = await finalizar(q.id);
    assert.equal(ok.json.number, `CP-${year()}-0001`, 'el número se reutiliza: no quedó un hueco');
  });

  it('el snapshot es inmutable: cambiar perfil, cliente o logo después no altera lo enviado', async () => {
    assert.equal((await app.upload('PUT', '/me/logo', { token: a.token, file: PNG() })).status, 200);
    const q = await completo();
    await finalizar(q.id);
    const token = await tokenOf(q.id);
    const antes = await app.api('GET', `/public/quotes/${token}`);
    assert.equal(antes.json.professional.has_logo, true);
    await app.api('PUT', '/me', { token: a.token, body: { name: 'Otro Nombre' } });
    const cid = (await pool.query('SELECT customer_id AS id FROM quotes WHERE id = $1', [q.id])).rows[0].id;
    await app.api('PUT', `/customers/${cid}`, { token: a.token, body: { name: 'Cliente Renombrado', phone: '+56900000000' } });
    assert.equal((await app.upload('PUT', '/me/logo', { token: a.token, file: Buffer.concat([PNG(), Buffer.alloc(10)]) })).status, 200, 'reemplazar el logo');
    const despues = await app.api('GET', `/public/quotes/${token}`);
    assert.equal(despues.json.professional.name, 'Ana');
    assert.equal(despues.json.customer.name, 'Juan Pérez');
    const logo = await fetch(`${app.base}/public/quotes/${token}/assets/logo`);
    assert.equal(logo.status, 200, 'el logo original sigue disponible para ese presupuesto');
    assert.equal(logo.headers.get('content-type'), 'image/png');
  });

  it('con IVA: el snapshot, la vista pública y el PDF llevan el IVA y la tasa con que se calculó', async () => {
    const q = await completo(a.token, { patch: { include_vat: true, discount: 1000 } });
    const r = await finalizar(q.id);
    assert.equal(r.status, 200);
    // 12,5 × 18.000 + 8 × 5.000 = 265.000; − 1.000 = 264.000; IVA 19 % = 50.160
    assert.deepEqual([r.json.subtotal, r.json.vat, r.json.total], [265000, 50160, 314160]);
    const { rows } = await pool.query('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [q.id]);
    assert.deepEqual([rows[0].snapshot.include_vat, rows[0].snapshot.vat, rows[0].snapshot.vat_rate, rows[0].snapshot.total], [true, 50160, 19, 314160]);
    const j = await (await fetch(`${app.base}/public/quotes/${await tokenOf(q.id)}`)).json();
    assert.deepEqual([j.include_vat, j.vat, j.vat_rate, j.total], [true, 50160, 19, 314160]);
    const sin = await completo();
    assert.deepEqual([(await finalizar(sin.id)).json.vat], [0], 'sin la casilla, el IVA es 0');
  });

  it('vista pública: solo lectura, sin datos internos ni de contacto del cliente, con cabeceras de privacidad', async () => {
    const q = await completo(a.token);
    await finalizar(q.id);
    const token = await tokenOf(q.id);
    const r = await fetch(`${app.base}/public/quotes/${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('x-robots-tag'), 'noindex');
    const j = await r.json();
    assert.deepEqual(Object.keys(j).sort(), ['customer', 'discount', 'finalized_at', 'include_vat', 'items', 'number', 'observations', 'pdf_url', 'professional', 'service_address', 'service_description', 'subtotal', 'total', 'valid_until', 'validity_days', 'vat', 'vat_rate', 'warranty']);
    const texto = JSON.stringify(j);
    for (const prohibido of ['NOTA INTERNA', a.user.id, q.id, 'juan@cliente.cl', '+56933333333', 'short_id', 'logo_file_id']) assert.ok(!texto.includes(prohibido), prohibido);
    assert.equal(j.pdf_url, `/public/quotes/${token}/pdf`);
    const pdf = await fetch(`${app.base}/public/quotes/${token}/pdf`);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await fetch(`${app.base}/public/quotes/${token}/assets/signature`)).status, 404, 'sin firma incluida');
    assert.equal((await fetch(`${app.base}/public/quotes/${token}/assets/logo`)).status, 404, 'sin logo');
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await fetch(`${app.base}/public/quotes/${token}`, { method: m })).status, 405, m);
  });

  it('token inexistente y revocado ⇒ el mismo 404; el ID del presupuesto no abre nada', async () => {
    const q = await completo();
    await finalizar(q.id);
    const token = await tokenOf(q.id);
    const falso = await fetch(`${app.base}/public/quotes/${'x'.repeat(32)}`);
    const cuerpo = await falso.text();
    assert.equal(falso.status, 404);
    assert.equal((await fetch(`${app.base}/public/quotes/${q.id}`)).status, 404);
    await pool.query(`UPDATE quote_access SET revoked_at = now() WHERE token = $1`, [token]);
    const revocado = await fetch(`${app.base}/public/quotes/${token}`);
    assert.equal(revocado.status, 404);
    assert.equal(await revocado.text(), cuerpo);
    assert.equal((await fetch(`${app.base}/public/quotes/${token}/pdf`)).status, 404);
  });

  it('vista pública: límite por IP', async () => {
    await app.close();
    app = await startApp({ publicLimit: 2 });
    for (let i = 0; i < 2; i++) assert.equal((await fetch(`${app.base}/public/quotes/zzz`)).status, 404);
    assert.equal((await fetch(`${app.base}/public/quotes/zzz`)).status, 429);
  });

  it('PDF, enlace y QR: solo finalizado y solo del dueño; el QR apunta a la vista pública', async () => {
    const q = await completo();
    for (const p of ['pdf', 'share', 'qr.png']) assert.equal((await app.api('GET', `/quotes/${q.id}/${p}`, { token: a.token })).status, 409, `${p} antes de finalizar`);
    await finalizar(q.id);
    const token = await tokenOf(q.id);
    const share = await app.api('GET', `/quotes/${q.id}/share`, { token: a.token });
    assert.deepEqual(share.json, { public_url: `${config.WEB_BASE_URL}/q/${token}`, qr_url: `/quotes/${q.id}/qr.png` });
    const qr = await fetch(`${app.base}/quotes/${q.id}/qr.png`, { headers: { Authorization: `Bearer ${a.token}` } });
    assert.equal(qr.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await qr.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
    const pdf = await fetch(`${app.base}/quotes/${q.id}/pdf`, { headers: { Authorization: `Bearer ${a.token}` } });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-disposition')!, /CP-\d{4}-0001\.pdf/);
    for (const p of ['pdf', 'share', 'qr.png']) assert.equal((await app.api('GET', `/quotes/${q.id}/${p}`, { token: b.token })).status, 404, `${p} de otro usuario`);
  });

  it('una firma o logo con contenido corrupto da 422 claro, no un 500', async () => {
    await app.upload('PUT', '/me/signature', { token: a.token, file: PNG_FALSO() });
    const q = await completo(a.token, { patch: { include_signature: true } });
    const r = await finalizar(q.id);
    assert.equal(r.status, 422);
    assert.equal(r.json.error.details[0].field, 'logo_o_firma');
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.doc_status, 'DRAFT');
    assert.deepEqual(filesOnDisk().filter((f) => f.endsWith('.pdf')), []);
  });

  it('el presupuesto trae al profesional y su logo: el actual mientras se edita y el fijado al finalizar', async () => {
    const q = await completo();
    const d0 = (await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json;
    assert.deepEqual(d0.professional, { name: 'Ana', phone: '+56911111111', email: 'a@test.cl', has_logo: false });
    const logo = (token: string, id = q.id) => fetch(`${app.base}/quotes/${id}/logo`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await logo(a.token)).status, 404, 'sin logo');
    await app.upload('PUT', '/me/logo', { token: a.token, file: PNG() });
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.professional.has_logo, true);
    const t = (await app.api('POST', '/access/code/exchange', { body: { code: q.access_code } })).json.token;
    for (const token of [a.token, t]) assert.equal((await logo(token)).headers.get('content-type'), 'image/png');
    assert.equal((await logo(b.token)).status, 404, 'B no ve el logo de A');
    await finalizar(q.id);
    await app.upload('PUT', '/me/logo', { token: a.token, file: Buffer.concat([PNG(), Buffer.alloc(8)]) }); // cambia el logo después
    const fijado = await logo(a.token);
    assert.equal(fijado.status, 200);
    assert.equal(Buffer.from(await fijado.arrayBuffer()).length, PNG().length, 'el finalizado conserva el logo original');
  });

  it('con el QR incluido el PDF lo lleva, y con la firma también (mayor que sin ellos)', async () => {
    const sin = await completo();
    await finalizar(sin.id);
    await app.upload('PUT', '/me/signature', { token: a.token, file: PNG() });
    const con = await completo(a.token, { patch: { include_qr: true, include_signature: true } });
    assert.equal((await finalizar(con.id)).status, 200);
    const tam = async (id: string) => Number((await pool.query(`SELECT f.size_bytes AS n FROM quote_documents d JOIN files f ON f.id = d.pdf_file_id WHERE d.quote_id = $1`, [id])).rows[0].n);
    assert.ok((await tam(con.id)) > (await tam(sin.id)));
  });

  it('send-email: adjunta el PDF, registra el envío solo si salió bien y no repite sent_at', async () => {
    const q = await completo();
    assert.equal((await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: {} })).status, 409, 'antes de finalizar');
    await finalizar(q.id);
    app.mailState.fail = true;
    const falla = await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: {} });
    assert.equal(falla.status, 502);
    let d = (await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json;
    assert.equal(d.commercial_status, 'NONE', 'un envío fallido no cuenta');
    assert.equal(d.sent_at, null);
    app.mailState.fail = false;
    const ok = await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: { message: 'Hola, aquí va.' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.commercial_status, 'SENT');
    const m = app.mails[0]!;
    assert.equal(m.to, 'juan@cliente.cl', 'por defecto, el correo del cliente');
    assert.match(m.subject, /^Presupuesto CP-\d{4}-0001 de Ana$/);
    assert.ok(m.text.includes('Hola, aquí va.') && m.text.includes(ok.json.public_url));
    assert.equal(m.attachment.content.subarray(0, 5).toString(), '%PDF-');
    const primero = ok.json.sent_at;
    const otro = await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: { to: 'Otro@Cliente.cl' } });
    assert.equal(app.mails[1]!.to, 'otro@cliente.cl');
    assert.equal(otro.json.sent_at, primero, 'el primer envío fija sent_at y no cambia');
    const eventos = await pool.query(`SELECT metadata FROM audit_events WHERE event = 'QUOTE_SENT' ORDER BY id`);
    assert.deepEqual(eventos.rows.map((r) => r.metadata), [{ channel: 'EMAIL' }, { channel: 'EMAIL' }]);
  });

  it('send-email: sin correo del cliente exige `to`; valida el cuerpo y limita por usuario', async () => {
    const q = await completo(a.token, { customer: { name: 'Sin Correo', phone: '+56933333333' } });
    await finalizar(q.id);
    const send = (body: object) => app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body });
    assert.equal((await send({})).status, 422);
    assert.equal((await send({ to: 'no-es-correo' })).status, 422);
    assert.equal((await send({ to: 'ok@cliente.cl', extra: 1 })).status, 422);
    assert.equal(app.mails.length, 0);
    await app.close();
    app = await startApp({ mailLimit: 2 });
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
    const q2 = await completo();
    await finalizar(q2.id);
    for (let i = 0; i < 2; i++) assert.equal((await app.api('POST', `/quotes/${q2.id}/send-email`, { token: a.token, body: {} })).status, 200);
    const r = await app.api('POST', `/quotes/${q2.id}/send-email`, { token: a.token, body: {} });
    assert.equal(r.status, 429);
  });

  it('mark-sent: WhatsApp/compartir/enlace pasan NONE → SENT una sola vez; finalizar sin enviar deja NONE', async () => {
    const q = await completo();
    assert.equal((await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: a.token, body: { channel: 'WHATSAPP' } })).status, 409, 'antes de finalizar');
    await finalizar(q.id);
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.commercial_status, 'NONE');
    assert.equal((await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: a.token, body: { channel: 'FAX' } })).status, 422);
    const r = await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: a.token, body: { channel: 'WHATSAPP' } });
    assert.equal(r.json.commercial_status, 'SENT');
    const r2 = await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: a.token, body: { channel: 'SHARE' } });
    assert.equal(r2.json.sent_at, r.json.sent_at);
    const eventos = await pool.query(`SELECT metadata FROM audit_events WHERE event = 'QUOTE_SENT' ORDER BY id`);
    assert.deepEqual(eventos.rows.map((e) => e.metadata.channel), ['WHATSAPP', 'SHARE']);
    assert.equal((await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: b.token, body: { channel: 'LINK' } })).status, 404);
  });

  it('sesión del código: completa y cierra su presupuesto, y después lo ve, descarga y envía', async () => {
    const q = await completo();
    const t = (await app.api('POST', '/access/code/exchange', { body: { code: q.access_code } })).json.token;
    const fin = await app.api('POST', `/quotes/${q.id}/finalize`, { token: t, body: {} });
    assert.equal(fin.status, 200);
    for (const p of ['pdf', 'share', 'qr.png']) assert.equal((await fetch(`${app.base}/quotes/${q.id}/${p}`, { headers: { Authorization: `Bearer ${t}` } })).status, 200, p);
    assert.equal((await app.api('POST', `/quotes/${q.id}/send-email`, { token: t, body: {} })).status, 200);
    assert.equal((await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: t, body: { channel: 'WHATSAPP' } })).status, 200);
    assert.equal((await app.api('PATCH', `/quotes/${q.id}`, { token: t, body: { address: 'x' } })).status, 409);
    const otro = await completo();
    assert.equal((await app.api('POST', `/quotes/${otro.id}/finalize`, { token: t, body: {} })).status, 404, 'no es su presupuesto');
  });
});
