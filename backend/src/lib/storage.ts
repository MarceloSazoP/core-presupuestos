import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { config } from '../config';

// Almacenamiento en disco tras put/path/remove por `storage_key` (Arquitectura A14). Las claves las arma siempre el
// servidor con UUID y una extensión fija, pero igual se comprueba que no salgan de la raíz.
const root = () => resolve(config.STORAGE_DIR);
export const tmpDir = () => join(root(), 'tmp');

export function pathOf(key: string): string {
  const p = resolve(root(), key);
  if (!p.startsWith(root() + sep)) throw new Error('storage_key fuera de la raíz');
  return p;
}

export const keyFor = (userId: string, quoteId: string | null, fileId: string, ext: string) =>
  quoteId ? `u/${userId}/q/${quoteId}/${fileId}.${ext}` : `u/${userId}/profile/${fileId}.${ext}`;

export async function put(key: string, tempPath: string): Promise<void> {
  const dest = pathOf(key);
  await mkdir(dirname(dest), { recursive: true });
  try {
    await rename(tempPath, dest);
  } catch {
    await copyFile(tempPath, dest); // otro volumen: copiar y borrar
    await rm(tempPath, { force: true });
  }
}

export const remove = (key: string) => rm(pathOf(key), { force: true });
export const removeMany = (keys: string[]) => Promise.all(keys.map((k) => remove(k).catch(() => {})));

export const ensureTmp = () => mkdir(tmpDir(), { recursive: true });

// Para sweep-files: todos los archivos bajo `u/` con su antigüedad.
export async function* walk(dir = join(root(), 'u')): AsyncGenerator<{ key: string; ageMs: number }> {
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
