import { reenviar } from "@/lib/reenviar";
import { sesionActual } from "@/lib/sesion";

export async function GET() {
  const s = await sesionActual();
  if (!s) return new Response("No autorizado", { status: 401 });
  return reenviar(`/quotes/${s.quoteId}/logo`, s.token);
}
