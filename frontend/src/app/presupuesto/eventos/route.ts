import { sesionActual } from "@/lib/sesion";

const BASE = process.env.API_BASE_URL ?? "http://localhost:3013/api/v1";
export const dynamic = "force-dynamic";

// Avisos de cambio en vivo (Contrato API §6): el navegador no tiene el token, así que el servidor de Next reenvía el flujo de la API.
// Si el navegador cierra la conexión, `req.signal` cierra también la de la API.
export async function GET(req: Request) {
  const s = await sesionActual();
  if (!s) return new Response("No autorizado", { status: 401 });
  const arriba = await fetch(`${BASE}/quotes/${s.quoteId}/events`, { headers: { Authorization: `Bearer ${s.token}` }, signal: req.signal, cache: "no-store" }).catch(() => null);
  if (arriba?.status === 204) return new Response(null, { status: 204 }); // la API tiene los avisos apagados: EventSource no reintenta
  if (!arriba?.ok || !arriba.body) return new Response("No disponible", { status: arriba?.status ?? 503 });
  return new Response(arriba.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
