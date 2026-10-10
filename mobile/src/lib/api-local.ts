// En desarrollo la API corre en el mismo computador que sirve Metro: se toma su dirección de `hostUri` («192.168.5.1:8081»)
// y se cambia el puerto por el de la API. Así no hay que editar la IP cada vez que el teléfono cambia de red.
export const PUERTO_API = 3013;

export function apiLocal(hostUri: string | null | undefined): string | null {
  const host = hostUri?.replace(/:\d+$/, ''); // sin el puerto de Metro (sirve también para «[::1]:8081»)
  return host ? `http://${host}:${PUERTO_API}/api/v1` : null;
}
