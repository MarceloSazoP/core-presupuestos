import { reenviar } from "@/lib/reenviar";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return reenviar(`/public/quotes/${encodeURIComponent(token)}/assets/logo`);
}
