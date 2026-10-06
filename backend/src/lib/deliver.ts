import { config } from '../config';
import { aviso, correoCorporativo, destacado, parrafo } from './plantilla-correo';
import { AppError } from '../errors';
import { hayCorreo, mandarCorreo } from './mail';

export type Channel = 'SMS' | 'EMAIL';
// `motivo`: para qué es el código; cambia el asunto y el texto (ingresar o eliminar la cuenta).
export type Motivo = 'ingreso' | 'eliminar';
export type SendCode = (channel: Channel, destination: string, code: string, motivo?: Motivo) => Promise<void>;

const MENSAJE = (code: string) => `CorePresupuesto: tu código es ${code}. Vale 10 minutos. No lo compartas con nadie.`;

// El mismo código con formato corporativo: grande y a la vista, con el plazo y la advertencia de no compartirlo.
export const correoCodigo = (code: string) =>
  correoCorporativo({
    preheader: `Tu código de ingreso es ${code}. Vale 10 minutos.`,
    titulo: 'Tu código de ingreso',
    cuerpo:
      parrafo('Usa este código para entrar a CORE Presupuestos:') +
      destacado(code, { grande: true, etiqueta: 'Código de verificación' }) +
      parrafo('Vale <strong>10 minutos</strong> y sirve una sola vez.') +
      aviso('<strong>No lo compartas con nadie.</strong> Nuestro equipo nunca te lo pedirá. Si no intentaste entrar, ignora este correo.'),
  });

// El código para confirmar la eliminación de la cuenta: se explica qué hará y que, si no lo pidió, no pase nada.
export const correoCodigoEliminar = (code: string) =>
  correoCorporativo({
    preheader: `Tu código para eliminar la cuenta es ${code}. Vale 10 minutos.`,
    titulo: 'Confirma que quieres eliminar tu cuenta',
    cuerpo:
      parrafo('Pediste eliminar tu cuenta de CORE Presupuestos. Para confirmarlo, escribe este código en la app:') +
      destacado(code, { grande: true, etiqueta: 'Código de confirmación' }) +
      parrafo('Vale <strong>10 minutos</strong> y sirve una sola vez.') +
      aviso('<strong>Eliminar la cuenta borra todo y no se puede deshacer:</strong> tus clientes, tus presupuestos (también los enviados), fotos, notas de voz y PDF. Los enlaces que ya enviaste dejarán de funcionar.') +
      parrafo('Si no fuiste tú, ignora este correo: tu cuenta sigue intacta.', { suave: true }),
  });

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
export const sendCode: SendCode = async (channel, destination, code, motivo = 'ingreso') => {
  const dev = config.OTP_LOG_CODES && config.NODE_ENV !== 'production';
  if (dev) console.log(`[OTP] ${channel} ${destination}: ${code}`);

  if (channel === 'EMAIL') {
    if (hayCorreo()) {
      return mandarCorreo(
        motivo === 'eliminar'
          ? { to: destination, subject: 'Código para eliminar tu cuenta de CorePresupuesto', text: `CorePresupuesto: tu código para eliminar la cuenta es ${code}. Vale 10 minutos. Si no lo pediste, ignora este correo: tu cuenta sigue intacta.`, html: correoCodigoEliminar(code) }
          : { to: destination, subject: 'Tu código de CorePresupuesto', text: MENSAJE(code), html: correoCodigo(code) },
      );
    }
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
