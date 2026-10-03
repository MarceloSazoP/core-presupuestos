// Cliente de la API (Contrato de API). Sin lógica de negocio: la app captura y presenta, las reglas viven en el backend.
// En un iPhone real `localhost` es el propio teléfono: EXPO_PUBLIC_API_URL debe apuntar a la IP del computador.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3013/api/v1';

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

// La sesión se registra una vez (ver session.tsx); así el cliente no depende de React.
let obtenerToken: () => string | null = () => null;
let alVencer: () => void = () => {};
export function configurarApi(o: { token: () => string | null; alVencer: () => void }) {
  obtenerToken = o.token;
  alVencer = o.alVencer;
}

type Opciones = { method?: string; body?: unknown; token?: string | null };

export async function api<T = unknown>(path: string, { method = 'GET', body, token }: Opciones = {}): Promise<T> {
  const t = token === undefined ? obtenerToken() : token;
  const esForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      // En multipart no se fija Content-Type: React Native agrega el boundary.
      headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(body !== undefined && !esForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : esForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && t) alVencer(); // la sesión venció o fue revocada
    throw new ApiError(res.status, json?.error?.code ?? 'INTERNAL', json?.error?.message ?? 'Error inesperado', json?.error?.details ?? []);
  }
  return json as T;
}

// Mensaje legible para mostrar en pantalla.
export function mensajeDe(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  if (e.status === 429) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (e.status === 422 && e.details.length) return e.details.map((d) => d.message).join('. ');
  return e.message;
}

// Subida multipart (fotos y notas de voz, Contrato API §6): el archivo viaja por su ruta local, sin cargarlo en memoria de JS.
export const subir = <T>(path: string, archivo: { uri: string; name: string; type: string }, campos: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  form.append('file', archivo as unknown as Blob);
  return api<T>(path, { method: 'POST', body: form });
};

// Fuente para expo-image y expo-audio: los archivos de la API se descargan con el token.
export const fuenteDeArchivo = (ruta: string) => {
  const t = obtenerToken();
  return { uri: BASE + ruta, headers: t ? { Authorization: `Bearer ${t}` } : undefined };
};
