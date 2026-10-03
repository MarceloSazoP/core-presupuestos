import nodemailer from 'nodemailer';
import { config } from '../config';
import { AppError } from '../errors';

export type QuoteMail = { to: string; subject: string; text: string; attachment: { filename: string; content: Buffer } };
export type SendMail = (m: QuoteMail) => Promise<void>;

const fail = (msg = 'No se pudo enviar el correo. Intenta de nuevo.') => new AppError(502, 'DELIVERY_FAILED', msg);

// Correo del presupuesto con el PDF adjunto. Un fallo devuelve 502 y NO se registra el envío (Contrato API §7).
// Proveedor: SMTP si está configurado (desarrollo y pruebas con una cuenta propia); si no, Resend por HTTPS sin SDK
// (Arquitectura A12). Tiempo de espera de 10 s y un solo reintento ante un error de red en Resend.
export const sendMail: SendMail = async (m) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, RESEND_API_KEY: key, EMAIL_FROM: from } = config;
  if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
    try {
      await nodemailer
        .createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, requireTLS: true, auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, connectionTimeout: 10_000, socketTimeout: 20_000 })
        .sendMail({ from: `"CorePresupuesto" <${from ?? SMTP_USER}>`, to: m.to, subject: m.subject, text: m.text, attachments: [{ filename: m.attachment.filename, content: m.attachment.content, contentType: 'application/pdf' }] });
      return;
    } catch (e) {
      console.error('[correo] fallo SMTP:', (e as Error).message);
      throw fail();
    }
  }
  if (!key || !from) throw fail('El envío por correo no está configurado.');
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
  throw fail();
};
