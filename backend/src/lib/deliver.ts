import { config } from '../config';
import { AppError } from '../errors';
import { hayCorreo, mandarCorreo } from './mail';

export type Channel = 'SMS' | 'EMAIL';
export type SendCode = (channel: Channel, destination: string, code: string) => Promise<void>;

const MENSAJE = (code: string) => `CorePresupuesto: tu código es ${code}. Vale 10 minutos. No lo compartas con nadie.`;

async function postSms(url: string, init: RequestInit): Promise<void> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      if (res.ok) return;
      if (res.status < 500) break; // un 4xx no se arregla reintentando
    } catch {
      /* error de red: un reintento */
    }
  }
  throw new AppError(502, 'DELIVERY_FAILED', 'No se pudo enviar el código. Intenta de nuevo.');
}

// El código de verificación sale por el proveedor configurado. Correo: el mismo SMTP o Resend de los presupuestos. SMS:
// Twilio por HTTPS sin SDK (Arquitectura A13). En desarrollo, OTP_LOG_CODES además lo escribe en el log y, si no hay
// proveedor de correo, es la única salida.
export const sendCode: SendCode = async (channel, destination, code) => {
  const dev = config.OTP_LOG_CODES && config.NODE_ENV !== 'production';
  if (dev) console.log(`[OTP] ${channel} ${destination}: ${code}`);

  if (channel === 'EMAIL') {
    if (hayCorreo()) return mandarCorreo({ to: destination, subject: 'Tu código de CorePresupuesto', text: MENSAJE(code) });
    if (dev) return;
    throw new AppError(502, 'DELIVERY_FAILED', 'El envío por correo no está configurado.');
  }

  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = config;
  // Sin Twilio el SMS no puede llegar: se avisa, en vez de dar por enviado un código que solo quedó en el log.
  if (!sid || !token || !from) throw new AppError(502, 'DELIVERY_FAILED', 'El envío por SMS aún no está disponible. Elige correo.');
  return postSms(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    body: new URLSearchParams({ To: destination, From: from, Body: MENSAJE(code) }),
  });
};

export const maskDestination = (channel: Channel, destination: string) =>
  channel === 'EMAIL'
    ? destination.replace(/^(.).*?(@.*)$/, '$1***$2')
    : `${destination.slice(0, 3)}${'*'.repeat(Math.max(destination.length - 5, 0))}${destination.slice(-2)}`;
