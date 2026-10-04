import { File } from 'expo-file-system';
import { Platform } from 'react-native';

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

// `reintentar`: ante un corte de red (iOS reutiliza conexiones que el servidor ya cerró) se repite UNA vez. Por defecto solo
// en métodos idempotentes; un POST solo si es seguro repetirlo (p. ej. subidas con `id`, que el servidor trata como reintento).
type Opciones = { method?: string; body?: unknown; token?: string | null; reintentar?: boolean };

export async function api<T = unknown>(path: string, { method = 'GET', body, token, reintentar = method !== 'POST' }: Opciones = {}): Promise<T> {
  const t = token === undefined ? obtenerToken() : token;
  const esForm = body instanceof FormData;
  const pedir = () =>
    fetch(BASE + path, {
      method,
      // En multipart no se fija Content-Type: React Native agrega el boundary.
      headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(body !== undefined && !esForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : esForm ? (body as FormData) : JSON.stringify(body),
    });
  let res: Response;
  try {
    res = await pedir().catch((e) => (reintentar ? pedir() : Promise.reject(e)));
  } catch (e) {
    // En desarrollo se agrega la causa real: un archivo ilegible o una URL mal armada también llegan aquí.
    throw new ApiError(0, 'SIN_CONEXION', `No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.${__DEV__ ? ` (${e instanceof Error ? e.message : String(e)})` : ''}`);
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
  // En desarrollo se muestra el motivo real (cámara, recorte de la foto, etc.) para poder diagnosticarlo en el teléfono.
  if (!(e instanceof ApiError)) return `Ocurrió un error inesperado. Inténtalo de nuevo.${__DEV__ ? ` (${e instanceof Error ? e.message : String(e)})` : ''}`;
  if (e.status === 429) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (e.status === 422 && e.details.length) return e.details.map((d) => d.message).join('. ');
  return e.message;
}

// Subida multipart (fotos y notas de voz, Contrato API §6). El `fetch` de Expo sigue el estándar web y NO admite el objeto
// `{ uri, name, type }` propio de React Native ("Unsupported FormDataPart implementation"): el archivo va como `File`
// (expo-file-system, que lee desde su ruta sin cargarlo entero en memoria de JS) o, en la web de desarrollo, como Blob.
export const subir = async <T>(path: string, archivo: { uri: string; name: string; type: string }, campos: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  const parte = Platform.OS === 'web' ? await (await fetch(archivo.uri)).blob() : new File(archivo.uri);
  form.append('file', parte as Blob, archivo.name);
  return api<T>(path, { method: 'POST', body: form, reintentar: 'id' in campos }); // con `id` repetir es seguro (Contrato API §1)
};

// Fuente para expo-image y expo-audio: los archivos de la API se descargan con el token.
export const fuenteDeArchivo = (ruta: string) => {
  const t = obtenerToken();
  return { uri: BASE + ruta, headers: t ? { Authorization: `Bearer ${t}` } : undefined };
};
