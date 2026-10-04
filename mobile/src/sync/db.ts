import * as SQLite from 'expo-sqlite';

// Almacén local (Arquitectura §5, modelo offline). `ops` es la cola de envío; `kv` guarda los borradores de los
// presupuestos (`q:<id>`), la última lista y el dueño de los datos. En la web hay otra implementación (db.web.ts).
export type Op = {
  seq: number; quote_id: string; method: string; path: string; body: string | null;
  file_uri: string | null; file_name: string | null; file_type: string | null; fields: string | null;
  state: 'pending' | 'failed'; attempts: number; last_error: string | null;
};
export type NuevaOp = Pick<Op, 'quote_id' | 'method' | 'path' | 'body' | 'file_uri' | 'file_name' | 'file_type' | 'fields'>;

const abierta = SQLite.openDatabaseAsync('balam.db').then(async (db) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ops (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, body TEXT,
      file_uri TEXT, file_name TEXT, file_type TEXT, fields TEXT,
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT);
    CREATE TABLE IF NOT EXISTS kv (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);`);
  return db;
});

export const ops = async () => (await abierta).getAllAsync<Op>('SELECT * FROM ops ORDER BY seq');
export const agregarOp = async (o: NuevaOp) =>
  void (await (await abierta).runAsync('INSERT INTO ops (quote_id, method, path, body, file_uri, file_name, file_type, fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', o.quote_id, o.method, o.path, o.body, o.file_uri, o.file_name, o.file_type, o.fields));
export const cambiarOp = async (seq: number, c: Partial<Pick<Op, 'state' | 'attempts' | 'last_error'>>) =>
  void (await (await abierta).runAsync('UPDATE ops SET state = COALESCE(?, state), attempts = COALESCE(?, attempts), last_error = COALESCE(?, last_error) WHERE seq = ?', c.state ?? null, c.attempts ?? null, c.last_error ?? null, seq));
export const borrarOp = async (seq: number) => void (await (await abierta).runAsync('DELETE FROM ops WHERE seq = ?', seq));

export const leerKv = async (k: string) => (await (await abierta).getFirstAsync<{ valor: string }>('SELECT valor FROM kv WHERE clave = ?', k))?.valor ?? null;
export const guardarKv = async (k: string, v: string) => void (await (await abierta).runAsync('INSERT INTO kv (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor', k, v));
export const listarKv = async (prefijo: string) => (await (await abierta).getAllAsync<{ valor: string }>('SELECT valor FROM kv WHERE clave LIKE ?', `${prefijo}%`)).map((r) => r.valor);
export const limpiarTodo = async () => void (await (await abierta).execAsync('DELETE FROM ops; DELETE FROM kv;'));
