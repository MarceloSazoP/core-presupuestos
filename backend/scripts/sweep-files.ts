import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pool, query } from '../src/db';
import { remove, tmpDir, walk } from '../src/lib/storage';

const HOUR = 3_600_000;

// Borra lo que quedó en disco sin fila en `files` (subidas cuya transacción falló o se cortó) y temporales viejos
// (Arquitectura §3, Archivos). La antigüedad mínima evita borrar un archivo que se está subiendo en este momento.
export async function sweepOrphans(minAgeMs = HOUR): Promise<string[]> {
  const removed: string[] = [];
  const known = new Set((await query<{ storage_key: string }>('SELECT storage_key FROM files')).rows.map((r) => r.storage_key));
  for await (const f of walk()) {
    if (known.has(f.key) || f.ageMs < minAgeMs) continue;
    await remove(f.key);
    removed.push(f.key);
  }
  try {
    for (const name of await readdir(tmpDir())) {
      const p = join(tmpDir(), name);
      if (Date.now() - (await stat(p)).mtimeMs >= minAgeMs) {
        await rm(p, { force: true });
        removed.push(`tmp/${name}`);
      }
    }
  } catch {
    /* sin carpeta temporal: nada que barrer */
  }
  return removed;
}

if (require.main === module) {
  void sweepOrphans()
    .then((r) => console.log(`Barridos ${r.length} archivos huérfanos`))
    .finally(() => pool.end());
}
