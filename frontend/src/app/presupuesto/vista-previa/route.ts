import { reenviar } from "@/lib/reenviar";
import { sesionActual } from "@/lib/sesion";

// Vista previa del borrador en PDF (Contrato API §7). Solo se muestra lo guardado: el editor guarda antes de abrirla.
export async function GET() {
  const s = await sesionActual();
  if (!s) return new Response("No autorizado", { status: 401 });
  return reenviar(`/quotes/${s.quoteId}/preview`, s.token);
}
