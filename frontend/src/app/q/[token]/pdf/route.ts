import { reenviar } from "@/lib/reenviar";

// Vista pública: el token de la URL es la credencial; la API valida y responde 404 si no existe o fue revocado.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return reenviar(`/public/quotes/${encodeURIComponent(token)}/pdf`);
}
