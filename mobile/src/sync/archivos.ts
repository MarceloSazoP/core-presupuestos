import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

// Fotos y voz pendientes de subir: se copian al almacenamiento permanente de la app (el caché puede ser purgado por iOS
// antes de que haya señal). Se borran al subirse o descartarse.
const carpeta = () => new Directory(Paths.document, 'pendientes');

export function guardarArchivo(uri: string, extension: string): string {
  carpeta().create({ idempotent: true, intermediates: true });
  const destino = new File(carpeta(), `${randomUUID()}.${extension}`);
  new File(uri).copy(destino);
  return destino.uri;
}

export function borrarArchivo(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ya no estaba: nada que limpiar
  }
}
