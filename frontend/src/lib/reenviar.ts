import 'server-only';
import { apiArchivo, ApiError } from './api';

// Entrega al navegador un archivo (PDF, logo) que la API sirve con el token: el navegador nunca ve ni la URL de la API
// ni el token. Se copian solo las cabeceras necesarias. `range` permite adelantar el audio (Safari lo exige).
export async function reenviar(path: string, token?: string, range?: string): Promise<Response> {
  try {
    const origen = await apiArchivo(path, token, range);
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const h of ['content-type', 'content-disposition', 'content-length', 'content-range', 'accept-ranges']) {
      const v = origen.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(origen.body, { status: origen.status, headers });
  } catch (e) {
    if (e instanceof ApiError) return new Response(e.status === 404 ? 'No encontrado' : e.message, { status: e.status === 503 ? 503 : e.status });
    throw e;
  }
}
