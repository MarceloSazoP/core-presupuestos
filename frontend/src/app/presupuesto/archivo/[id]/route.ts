import sharp from "sharp";
import { apiArchivo } from "@/lib/api";
import { reenviar } from "@/lib/reenviar";
import { sesionActual } from "@/lib/sesion";

// Foto o nota de voz del presupuesto de la sesión. La API solo entrega archivos de ese presupuesto (404 si es otro).
// Con `?mini=1` una foto sale reducida (cuadrada de 480 px, JPEG): 30 fotos de la visita no deben bajar completas.
// Un archivo nunca cambia (su id es único), así que el navegador lo guarda; es privado, no se comparte en cachés.
const LADO_MINIATURA = 480;
const CACHE = "private, max-age=31536000, immutable";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sesionActual();
  if (!s) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const ruta = `/files/${encodeURIComponent(id)}`;

  if (new URL(req.url).searchParams.get("mini") === "1") {
    try {
      const origen = await apiArchivo(ruta, s.token);
      const mini = await sharp(Buffer.from(await origen.arrayBuffer()))
        .rotate() // respeta la orientación con la que se tomó la foto
        .resize(LADO_MINIATURA, LADO_MINIATURA, { fit: "cover" })
        .jpeg({ quality: 70 })
        .toBuffer();
      return new Response(new Uint8Array(mini), { headers: { "Content-Type": "image/jpeg", "Cache-Control": CACHE, "X-Content-Type-Options": "nosniff" } });
    } catch {
      // no era una imagen legible o la API no respondió: se entrega el archivo tal cual (o su error)
    }
  }
  const respuesta = await reenviar(ruta, s.token, req.headers.get("range") ?? undefined);
  if (respuesta.ok) respuesta.headers.set("Cache-Control", CACHE);
  return respuesta;
}
