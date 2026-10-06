import { copyFile, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import type { Request, Response as Res } from 'express';
import { config } from '../config';

// Almacenamiento en disco tras put/path/remove por `storage_key` (Arquitectura A14). Las claves las arma siempre el
// servidor con UUID y una extensión fija, pero igual se comprueba que no salgan de la raíz.
const root = () => resolve(config.STORAGE_DIR);
const supa = () => config.STORAGE_DRIVER === 'supabase';
export const tmpDir = () => (supa() ? join(tmpdir(), 'corepresupuesto') : join(root(), 'tmp')); // Vercel solo deja escribir en /tmp

// Supabase Storage (bucket privado, clave service_role que solo vive en el servidor).
const objeto = (key: string) => `${config.SUPABASE_URL}/storage/v1/object/${config.SUPABASE_BUCKET}/${key}`;
const auth = () => ({ Authorization: `Bearer ${config.SUPABASE_SERVICE_KEY}` });
async function supaFetch(url: string, init: RequestInit): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { ...auth(), ...init.headers } });
  if (!r.ok && r.status !== 404) throw new Error(`Supabase Storage respondió ${r.status}`);
  return r;
}


export function pathOf(key: string): string {
  const p = resolve(root(), key);
  if (!p.startsWith(root() + sep)) throw new Error('storage_key fuera de la raíz');
  return p;
}

export const keyFor = (userId: string, quoteId: string | null, fileId: string, ext: string) =>
  quoteId ? `u/${userId}/q/${quoteId}/${fileId}.${ext}` : `u/${userId}/profile/${fileId}.${ext}`;

export async function put(key: string, tempPath: string): Promise<void> {
  if (supa()) {
    await supaFetch(objeto(key), { method: 'POST', headers: { 'x-upsert': 'true', 'Content-Type': 'application/octet-stream' }, body: await readFile(tempPath) });
    await rm(tempPath, { force: true });
    return;
  }
  const dest = pathOf(key);
  await mkdir(dirname(dest), { recursive: true });
  try {
    await rename(tempPath, dest);
  } catch {
    await copyFile(tempPath, dest); // otro volumen: copiar y borrar
    await rm(tempPath, { force: true });
  }
}

export const remove = async (key: string) => void (supa() ? await supaFetch(objeto(key), { method: 'DELETE' }) : await rm(pathOf(key), { force: true }));
export const removeMany = (keys: string[]) => Promise.all(keys.map((k) => remove(k).catch(() => {})));

export const ensureTmp = () => mkdir(tmpDir(), { recursive: true });

export async function read(key: string): Promise<Buffer> {
  if (!supa()) return readFile(pathOf(key));
  const r = await supaFetch(objeto(key), { method: 'GET' });
  if (r.status === 404) throw Object.assign(new Error('archivo inexistente'), { code: 'ENOENT' });
  return Buffer.from(await r.arrayBuffer());
}

// Responde con el archivo. En disco, sendFile (con rangos, que el audio necesita); en Supabase se lee entero (cabe: tope de 4,5 MB
// por función) y se atiende un solo `Range: bytes=a-b`. ponytail: sin ETag ni caché; agregar si el tráfico lo pide.
export async function send(req: Request, res: Res, key: string): Promise<void> {
  if (!supa()) return new Promise((ok, fail) => res.sendFile(pathOf(key), (err) => (err ? fail(err) : ok())));
  const data = await read(key);
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  res.set('Accept-Ranges', 'bytes');
  if (!m || (!m[1] && !m[2])) return void res.send(data);
  const ini = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2]));
  const fin = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
  if (ini > fin || ini >= data.length) return void res.status(416).set('Content-Range', `bytes */${data.length}`).end();
  res.status(206).set('Content-Range', `bytes ${ini}-${fin}/${data.length}`).send(data.subarray(ini, fin + 1));
}

// Para sweep-files: todos los archivos bajo `u/` con su antigüedad.
export async function* walk(dir = join(root(), 'u')): AsyncGenerator<{ key: string; ageMs: number }> {
  if (supa()) throw new Error('sweep-files solo recorre el disco; con Supabase Storage aún no hay barrido');
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield { key: full.slice(root().length + 1).split(sep).join('/'), ageMs: Date.now() - (await stat(full)).mtimeMs };
  }
}
