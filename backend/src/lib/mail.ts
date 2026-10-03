import { config } from '../config';
import { AppError } from '../errors';

export type QuoteMail = { to: string; subject: string; text: string; attachment: { filename: string; content: Buffer } };
export type SendMail = (m: QuoteMail) => Promise<void>;

// Correo del presupuesto con el PDF adjunto, por HTTPS a Resend y sin SDK (Arquitectura A12). Tiempo de espera de 10 s
// y un solo reintento ante un error de red; un fallo devuelve 502 y NO se registra el envío (Contrato API §7).
export const sendMail: SendMail = async (m) => {
  const { RESEND_API_KEY: key, EMAIL_FROM: from } = config;
  if (!key || !from) throw new AppError(502, 'DELIVERY_FAILED', 'El envío por correo no está configurado.');
  const body = JSON.stringify({
    from, to: [m.to], subject: m.subject, text: m.text,
    attachments: [{ filename: m.attachment.filename, content: m.attachment.content.toString('base64') }],
  });
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      if (res.status < 500) break;
    } catch {
      /* error de red: un reintento */
    }
  }
  throw new AppError(502, 'DELIVERY_FAILED', 'No se pudo enviar el correo. Intenta de nuevo.');
};
