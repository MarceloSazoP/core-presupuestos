import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { pool, query } from '../src/db';
import { randomToken, sha256 } from '../src/lib/crypto';

// Crea datos de demostración con códigos REALES para probar la web sin la app móvil: un profesional, un presupuesto
// pendiente y uno finalizado. Pasa por la API (no escribe filas a mano), así que prueba el camino completo.
// Solo desarrollo. Cada ejecución crea presupuestos nuevos y muestra sus códigos (el secreto no se puede volver a leer).
if (config.NODE_ENV === 'production') throw new Error('seed-demo no corre en producción');

const e = process.env;
const pro = {
  name: e.DEMO_PRO_NAME ?? 'Profesional de prueba',
  phone: (e.DEMO_PRO_PHONE ?? '+56900000001').replace(/[^\d+]/g, ''),
  email: (e.DEMO_PRO_EMAIL ?? 'profesional@example.com').toLowerCase(),
};
const customer = {
  name: e.DEMO_CLIENT_NAME ?? 'Cliente de pruebas',
  phone: (e.DEMO_CLIENT_PHONE ?? '+56900000002').replace(/[^\d+]/g, ''),
  ...(e.DEMO_CLIENT_EMAIL ? { email: e.DEMO_CLIENT_EMAIL.toLowerCase() } : {}),
};

async function main() {
  // El profesional y su sesión se crean directo en la BD (es lo único que la API exige hacer con SMS/correo).
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (phone, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [pro.phone, pro.email, pro.name]);
  const token = randomToken();
  await query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [rows[0]!.id, sha256(token)]);

  const server = createApp({ sendMail: async () => {} }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const api = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
    return json;
  };

  const crear = async (service: string) =>
    api('POST', '/quotes', { customer, service_description: service, address: 'Av. Siempre Viva 742' });

  // Pendiente: lo que la app dejaría tras la visita (levantamiento y un ítem sin cerrar).
  const pendiente = await crear('Instalación de enchufes y revisión de tablero');
  await api('PUT', `/quotes/${pendiente.id}/survey`, { notes: 'Casa de dos pisos. Tablero antiguo, sin tierra de protección. El cliente quiere 4 enchufes nuevos en el living.' });
  await api('PUT', `/quotes/${pendiente.id}/measurements`, { measurements: [{ label: 'Largo del pasillo', value: '6,5 m' }, { label: 'Puntos nuevos', value: '4' }] });
  await api('POST', `/quotes/${pendiente.id}/save`, {});

  // Finalizado: completo y emitido, para ver la vista cerrada, el PDF y los envíos.
  const finalizado = await crear('Cambio de piso flotante en dormitorio');
  await api('PATCH', `/quotes/${finalizado.id}`, { validity_days: 15, warranty: { kind: 'M3' }, observations: 'Incluye retiro de escombros.' });
  await api('PUT', `/quotes/${finalizado.id}/items`, { items: [
    { description: 'Piso flotante 8 mm', quantity: 12.5, unit: 'm2', unit_price: 18000 },
    { description: 'Mano de obra', quantity: 8, unit: 'hh', unit_price: 5000 },
  ] });
  await api('POST', `/quotes/${finalizado.id}/finalize`, {});

  console.log('\nDatos de demostración creados. Códigos (se muestran una sola vez):');
  console.log(`  Pendiente  (completar o editar): ${pendiente.access_code}`);
  console.log(`  Finalizado (solo ver / PDF):     ${finalizado.access_code}\n`);
  await new Promise<void>((r) => server.close(() => r()));
}

void main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => pool.end());
