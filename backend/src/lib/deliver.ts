import { config } from '../config';
import { AppError } from '../errors';

export type Channel = 'SMS' | 'EMAIL';
export type SendCode = (channel: Channel, destination: string, code: string) => Promise<void>;

const MENSAJE = (code: string) => `CorePresupuesto: tu código es ${code}. Vale 10 minutos. No lo compartas con nadie.`;

async function post(url: string, init: RequestInit): Promise<void> {
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

// Un envío por proveedor, sin SDK (Arquitectura A12 y A13). En desarrollo, OTP_LOG_CODES lo escribe en el log.
export const sendCode: SendCode = async (channel, destination, code) => {
  if (config.OTP_LOG_CODES && config.NODE_ENV !== 'production') {
    console.log(`[OTP] ${channel} ${destination}: ${code}`);
    return;
  }
  if (channel === 'SMS') {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = config;
    if (!sid || !token || !from) throw new AppError(502, 'DELIVERY_FAILED', 'El envío por SMS no está configurado.');
    return post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
      body: new URLSearchParams({ To: destination, From: from, Body: MENSAJE(code) }),
    });
  }
  const { RESEND_API_KEY: key, EMAIL_FROM: from } = config;
  if (!key || !from) throw new AppError(502, 'DELIVERY_FAILED', 'El envío por correo no está configurado.');
  return post('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [destination], subject: 'Tu código de CorePresupuesto', text: MENSAJE(code) }),
  });
};

export const maskDestination = (channel: Channel, destination: string) =>
  channel === 'EMAIL'
    ? destination.replace(/^(.).*?(@.*)$/, '$1***$2')
    : `${destination.slice(0, 3)}${'*'.repeat(Math.max(destination.length - 5, 0))}${destination.slice(-2)}`;
