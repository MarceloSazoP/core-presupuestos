import 'server-only';
import { cookies } from 'next/headers';

const COOKIE = 'cp_sesion';

export type Sesion = { quoteId: string; token: string };

// La cookie guarda la sesión QUOTE_CODE que entregó la API al canjear el código (dura 30 min; la API manda). Es httpOnly:
// el navegador no la lee. El código en sí nunca se guarda.
export async function abrirSesion(quoteId: string, token: string, expiraEn: string): Promise<void> {
  const maxAge = Math.max(1, Math.floor((Date.parse(expiraEn) - Date.now()) / 1000));
  (await cookies()).set(COOKIE, `${quoteId}.${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

export async function sesionActual(): Promise<Sesion | null> {
  const valor = (await cookies()).get(COOKIE)?.value;
  const corte = valor?.indexOf('.') ?? -1;
  if (!valor || corte < 1) return null;
  return { quoteId: valor.slice(0, corte), token: valor.slice(corte + 1) };
}

export async function cerrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
