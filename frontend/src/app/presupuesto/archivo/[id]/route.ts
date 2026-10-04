import { reenviar } from "@/lib/reenviar";
import { sesionActual } from "@/lib/sesion";

// Foto o nota de voz del presupuesto de la sesión. La API solo entrega archivos de ese presupuesto (404 si es otro).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sesionActual();
  if (!s) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  return reenviar(`/files/${encodeURIComponent(id)}`, s.token, req.headers.get("range") ?? undefined);
}
