import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { formatoMonto, PAISES, paisDelTelefono, zonaValida } from '../src/lib/paises';
import { PAISES as PAISES_APP } from '../../mobile/src/lib/paises';
import { PAISES as PAISES_WEB } from '../../frontend/src/lib/paises';
import { sumTotals, vatOf } from '../src/modules/quotes/totals';
import { assertTestDb, resetDb, startApp } from './helpers';

// Varios países (Internacionalización.md §6): moneda, impuesto, teléfono y zona horaria.
describe('países: tabla, formato de montos, teléfonos e impuesto por tasa', () => {
  it('la tabla es coherente y cada prefijo es de un solo país', () => {
    assert.equal(PAISES.length, 12);
    assert.equal(new Set(PAISES.map((p) => p.country)).size, PAISES.length);
    assert.equal(new Set(PAISES.map((p) => p.calling_code)).size, PAISES.length);
    for (const p of PAISES) assert.ok(p.vat_rate > 0 && p.vat_rate < 100 && /^\+\d{2,3}$/.test(p.calling_code) && p.currency.length === 3, p.country);
  });

  it('las tablas de la app móvil y de la web son idénticas a la del servidor', () => {
    assert.deepEqual(PAISES_APP, PAISES);
    assert.deepEqual(PAISES_WEB, PAISES);
  });

  it('el monto lleva el símbolo y el separador de su moneda', () => {
    assert.equal(formatoMonto(1234567, 'CLP'), '$1.234.567');
    assert.equal(formatoMonto(1234567, 'PEN'), 'S/ 1,234,567');
    assert.equal(formatoMonto(1234567, 'MXN'), '$1,234,567');
    assert.equal(formatoMonto(1234567, 'USD'), '$1,234,567', 'Ecuador y Panamá usan dólares con estilo de dólar');
    assert.equal(formatoMonto(1234567, 'CRC'), '₡1 234 567');
    assert.equal(formatoMonto(999, 'COP'), '$999');
    assert.equal(formatoMonto(-5000, 'CLP'), '-$5.000');
    assert.equal(formatoMonto(100, 'XXX'), '$100', 'una moneda desconocida cae en la de Chile en vez de fallar');
  });

  it('el país de un teléfono sale de su prefijo, y uno desconocido no adivina', () => {
    assert.equal(paisDelTelefono('+56912345678')?.country, 'CL');
    assert.equal(paisDelTelefono('+51987654321')?.country, 'PE');
    assert.equal(paisDelTelefono('+59899123456')?.country, 'UY', '+598 no se confunde con +59x de otro país');
    assert.equal(paisDelTelefono('+5491122334455')?.country, 'AR');
    assert.equal(paisDelTelefono('+34600111222'), undefined);
  });

  it('el impuesto usa la tasa del presupuesto y redondea .5 hacia arriba', () => {
    assert.equal(vatOf(100000, 16), 16000);
    assert.equal(vatOf(100000, 18), 18000);
    assert.equal(vatOf(100000), 19000, 'sin tasa, la de Chile de antes');
    assert.equal(vatOf(50, 18), 9);
    assert.deepEqual(sumTotals([10000], 1000, true, 16), { subtotal: 10000, vat: 1440, total: 10440 });
    assert.equal(zonaValida('America/Lima'), true);
    assert.equal(zonaValida('Marte/Base'), false);
  });
});

let app: Awaited<ReturnType<typeof startApp>>;

describe('API: país y zona horaria del usuario, y presupuestos que guardan su propia moneda e impuesto', () => {
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
    app = await startApp();
  });
  afterEach(async () => {
    await app.close();
  });

  const crear = async (token: string) => (await app.api('POST', '/quotes', { token, body: { customer: { name: 'Juan', phone: '+51999999999' } } })).json;

  it('GET /countries es público y el país de un usuario nuevo sale de su teléfono', async () => {
    const lista = await app.api('GET', '/countries');
    assert.equal(lista.status, 200);
    assert.equal(lista.json.length, 12);
    assert.deepEqual(Object.keys(lista.json[0]).sort(), ['calling_code', 'country', 'currency', 'name', 'symbol', 'thousands', 'vat_label', 'vat_rate']);
    const peru = await app.login('+51987654321', 'p@test.pe', 'Pedro');
    const yo = (await app.api('GET', '/me', { token: peru.token })).json;
    assert.deepEqual([yo.country, yo.timezone], ['PE', 'America/Santiago']);
    const chile = await app.login('+56911111111', 'c@test.cl', 'Carla');
    assert.equal((await app.api('GET', '/me', { token: chile.token })).json.country, 'CL');
  });

  it('PUT /me valida el país y la zona horaria', async () => {
    const u = await app.login('+56911111111', 'a@test.cl', 'Ana');
    const ok = await app.api('PUT', '/me', { token: u.token, body: { country: 'MX', timezone: 'America/Mexico_City' } });
    assert.equal(ok.status, 200);
    assert.deepEqual([ok.json.country, ok.json.timezone], ['MX', 'America/Mexico_City']);
    assert.equal((await app.api('PUT', '/me', { token: u.token, body: { country: 'XX' } })).status, 422);
    assert.equal((await app.api('PUT', '/me', { token: u.token, body: { timezone: 'Marte/Base' } })).status, 422);
    assert.equal((await app.api('GET', '/me', { token: u.token })).json.country, 'MX', 'un valor inválido no cambia nada');
  });

  it('el presupuesto copia país, moneda e impuesto al crearse y no cambia si el usuario cambia de país', async () => {
    const u = await app.login('+52551234567', 'm@test.mx', 'Marta');
    const q1 = await crear(u.token);
    assert.deepEqual([q1.country, q1.currency, q1.vat_label, q1.vat_rate], ['MX', 'MXN', 'IVA', 16]);
    await app.api('PUT', `/quotes/${q1.id}/items`, { token: u.token, body: { items: [{ description: 'x', quantity: 1, unit_price: 100000 }] } });
    const conIva = (await app.api('PATCH', `/quotes/${q1.id}`, { token: u.token, body: { include_vat: true } })).json;
    assert.deepEqual([conIva.vat, conIva.total], [16000, 116000], 'México: 16 %');

    await app.api('PUT', '/me', { token: u.token, body: { country: 'PE' } });
    const q2 = await crear(u.token);
    assert.deepEqual([q2.country, q2.currency, q2.vat_label, q2.vat_rate], ['PE', 'PEN', 'IGV', 18]);
    const viejo = (await app.api('GET', `/quotes/${q1.id}`, { token: u.token })).json;
    assert.deepEqual([viejo.currency, viejo.vat_rate, viejo.total], ['MXN', 16, 116000], 'el anterior no cambia');
    const lista = (await app.api('GET', '/quotes', { token: u.token })).json.data as { id: string; currency: string }[];
    assert.equal(lista.find((q) => q.id === q1.id)?.currency, 'MXN');
    assert.equal(lista.find((q) => q.id === q2.id)?.currency, 'PEN');
  });

  it('al finalizar, el snapshot fija moneda, impuesto, zona y fecha, y la vista pública los muestra', async () => {
    const u = await app.login('+51987654321', 'p@test.pe', 'Pedro');
    await app.api('PUT', '/me', { token: u.token, body: { timezone: 'America/Lima' } });
    const q = await crear(u.token);
    await app.api('PATCH', `/quotes/${q.id}`, { token: u.token, body: { service_description: 'Servicio', validity_days: 15, include_vat: true } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token: u.token, body: { items: [{ description: 'x', quantity: 1, unit_price: 100000 }] } });
    const fin = await app.api('POST', `/quotes/${q.id}/finalize`, { token: u.token, body: {} });
    assert.equal(fin.status, 200);
    const token = (await pool.query<{ token: string }>(`SELECT token FROM quote_access WHERE quote_id = $1 AND kind = 'PUBLIC'`, [q.id])).rows[0]!.token;
    const v = (await app.api('GET', `/public/quotes/${token}`)).json;
    assert.deepEqual([v.country, v.currency, v.vat_label, v.vat_rate, v.timezone], ['PE', 'PEN', 'IGV', 18, 'America/Lima']);
    assert.match(v.issued_on, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(v.total, 118000);
    const año = (await pool.query<{ year: number }>(`SELECT extract(year FROM now() AT TIME ZONE 'America/Lima')::int AS year`)).rows[0]!.year;
    assert.match(fin.json.number, new RegExp(`^CP-${año}-`), 'el año de la numeración es el de la zona del usuario');
  });

  it('«hoy» es el de la zona del usuario: el mismo contacto vence en una y no en otra', async () => {
    const u = await app.login('+56911111111', 'a@test.cl', 'Ana');
    const q = await crear(u.token);
    await app.api('PATCH', `/quotes/${q.id}`, { token: u.token, body: { service_description: 'Servicio', validity_days: 15 } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token: u.token, body: { items: [{ description: 'x', quantity: 1, unit_price: 10000 }] } });
    await app.api('POST', `/quotes/${q.id}/finalize`, { token: u.token, body: {} });
    await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: u.token, body: { channel: 'LINK' } });
    // Pago Pago (UTC−11) y Kiritimati (UTC+14) están 25 horas apart: nunca comparten la fecha de hoy.
    const hoy = (zona: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
    const contacto = hoy('Pacific/Kiritimati'); // hoy en Kiritimati: futuro en Pago Pago
    await app.api('PUT', '/me', { token: u.token, body: { timezone: 'Pacific/Pago_Pago' } });
    assert.equal((await app.api('POST', `/quotes/${q.id}/follow-ups`, { token: u.token, body: { next_contact_date: contacto } })).status, 201);
    assert.equal((await app.api('GET', '/dashboard', { token: u.token })).json.counts.follow_up, 0, 'en Pago Pago todavía no toca');
    await app.api('PUT', '/me', { token: u.token, body: { timezone: 'Pacific/Kiritimati' } });
    assert.equal((await app.api('GET', '/dashboard', { token: u.token })).json.counts.follow_up, 1, 'en Kiritimati ya es hoy');
    const k = (await app.api('GET', '/dashboard/kpis', { token: u.token })).json;
    assert.equal(k.month, hoy('Pacific/Kiritimati').slice(0, 7), 'el mes de los indicadores sale de la zona del usuario');
  });
});
