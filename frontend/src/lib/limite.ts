import 'server-only';

// ponytail: memoria de un solo proceso; con más de una instancia pasa a la BD o a Redis.
const registro = new Map<string, number[]>();

export function permitir(clave: string, maximo: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const recientes = (registro.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  const permitido = recientes.length < maximo;
  if (permitido) recientes.push(ahora);
  registro.set(clave, recientes);
  return permitido;
}
