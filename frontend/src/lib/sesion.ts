import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'cp_sesion';
const VIGENCIA_SEGUNDOS = 30 * 60;

function secreto(): string {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.length < 32) throw new Error('Falta SESSION_SECRET (mínimo 32 caracteres) en .env.local');
  return valor;
}

const firmar = (datos: string) => createHmac('sha256', secreto()).update(datos).digest('base64url');

// La cookie solo prueba que el código ya se verificó; el código en sí nunca se guarda en ella.
export async function abrirSesion(presupuestoId: string): Promise<void> {
  const expira = Math.floor(Date.now() / 1000) + VIGENCIA_SEGUNDOS;
  const datos = `${presupuestoId}.${expira}`;
  (await cookies()).set(COOKIE, `${datos}.${firmar(datos)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VIGENCIA_SEGUNDOS,
  });
}

export async function sesionActual(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;
  const corte = valor.lastIndexOf('.');
  const datos = valor.slice(0, corte);
  const recibida = Buffer.from(valor.slice(corte + 1));
  const esperada = Buffer.from(firmar(datos));
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  const [id, expira] = datos.split('.');
  return id && Number(expira) > Date.now() / 1000 ? id : null;
}

export async function cerrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
