import { Directory, File, Paths } from 'expo-file-system';

// Fotos y voz pendientes de subir: se copian al almacenamiento permanente de la app (el caché puede ser purgado por iOS
// antes de que haya señal). Se borran al subirse o descartarse.
const carpeta = () => new Directory(Paths.document, 'pendientes');

// `copy` es asíncrono: hay que esperarlo, o la cola intenta subir un archivo que aún no existe.
export async function guardarArchivo(uri: string): Promise<string> {
  carpeta().create({ idempotent: true, intermediates: true });
  const origen = new File(uri);
  await origen.copy(carpeta());
  const destino = new File(carpeta(), origen.name);
  if (__DEV__) console.log('[archivos] copiado', uri, '→', destino.uri, `existe=${destino.exists}`, `bytes=${destino.exists ? destino.size : 0}`);
  if (!destino.exists) throw new Error('No se pudo guardar el archivo en el teléfono');
  return destino.uri;
}

export const existeArchivo = (uri: string) => new File(uri).exists;

export function borrarArchivo(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ya no estaba: nada que limpiar
  }
}
