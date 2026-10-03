import 'server-only';

// La web es un BFF (Arquitectura §6): solo el servidor de Next habla con la API, con el token de la sesión. El navegador
// nunca ve el token.
const BASE = process.env.API_BASE_URL ?? 'http://localhost:3013/api/v1';

export type Detalle = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Detalle[] = [],
  ) {
    super(message);
  }
}

type Opciones = { token?: string; method?: string; body?: unknown };

async function pedir(path: string, { token, method = 'GET', body }: Opciones): Promise<Response> {
  try {
    return await fetch(BASE + path, {
      method,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(503, 'UNAVAILABLE', 'No se pudo conectar con el servidor. Intenta de nuevo en un momento.');
  }
}

async function comoError(res: Response): Promise<ApiError> {
  const e = (await res.json().catch(() => null))?.error;
  return new ApiError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'Error inesperado', e?.details ?? []);
}

export async function api<T = unknown>(path: string, o: Opciones = {}): Promise<T> {
  const res = await pedir(path, o);
  if (!res.ok) throw await comoError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Para archivos (PDF, logo): devuelve la respuesta tal cual, o el error de la API.
export async function apiArchivo(path: string, token?: string): Promise<Response> {
  const res = await pedir(path, { token });
  if (!res.ok) throw await comoError(res);
  return res;
}
