import { Client } from 'pg';
import { config } from '../config';

// Avisos de cambio en vivo (Contrato BD §20): UNA conexión LISTEN por proceso reparte `quote_changed` a quienes miran ese presupuesto.
const oyentes = new Map<string, Set<() => void>>();
let escucha: Promise<Client> | null = null;

function conectar(): Promise<Client> {
  const c = new Client({ connectionString: config.DATABASE_URL });
  c.on('notification', (m) => m.payload && oyentes.get(m.payload)?.forEach((f) => f()));
  // Si la conexión se cae se vuelve a abrir en la próxima suscripción (el cliente EventSource reconecta solo).
  c.on('error', () => (escucha = null));
  c.on('end', () => (escucha = null));
  return c.connect().then(() => c.query('LISTEN quote_changed')).then(() => c);
}

export async function suscribir(quoteId: string, f: () => void): Promise<() => void> {
  await (escucha ??= conectar().catch((e) => ((escucha = null), Promise.reject(e))));
  const set = oyentes.get(quoteId) ?? new Set();
  set.add(f);
  oyentes.set(quoteId, set);
  return () => {
    set.delete(f);
    if (set.size === 0) oyentes.delete(quoteId);
  };
}

export async function cerrarAvisos() {
  const c = await escucha?.catch(() => null);
  escucha = null;
  oyentes.clear();
  await c?.end();
}
