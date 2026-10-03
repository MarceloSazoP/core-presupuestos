import { generarPdf } from "@/lib/pdf";
import { esFinalizado, porId } from "@/lib/presupuestos";
import { sesionActual } from "@/lib/sesion";

export async function GET() {
  const id = await sesionActual();
  const presupuesto = id ? await porId(id) : null;
  if (!presupuesto) return new Response("No autorizado", { status: 401 });
  if (!esFinalizado(presupuesto)) return new Response("El presupuesto aún no está terminado", { status: 409 });

  const pdf = await generarPdf(presupuesto);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${presupuesto.numero}.pdf"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
