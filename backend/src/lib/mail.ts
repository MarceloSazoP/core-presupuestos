import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import { AppError } from '../errors';

// `html`: el cuerpo con formato. `cid` en el adjunto lo vuelve una imagen incrustada que el HTML cita (`<img src="cid:…">`): se ve dentro del correo, no como archivo.
export type Correo = { to: string; subject: string; text: string; html?: string; attachment?: { filename: string; content: Buffer; contentType?: string; cid?: string } };
export type SendMail = (m: Correo) => Promise<void>;

let transporte: Transporter | null = null;
const fail = (msg = 'No se pudo enviar el correo. Intenta de nuevo.') => new AppError(502, 'DELIVERY_FAILED', msg);

const hayResend = () => !!config.RESEND_API_KEY && !!config.EMAIL_FROM;
const haySmtp = () => !!config.SMTP_HOST && !!config.SMTP_USER && !!config.SMTP_PASSWORD;
// ¿Hay algún proveedor de correo configurado? (el código de verificación solo se envía si lo hay)
export const hayCorreo = () => haySmtp() || hayResend();

// Un correo, con o sin adjunto. Un fallo devuelve 502 y NO se registra el envío (Contrato API §7).
// Proveedor: SMTP si está configurado (desarrollo y pruebas con una cuenta propia); si no, Resend por HTTPS sin SDK
// (Arquitectura A12). Tiempo de espera de 10 s y un solo reintento ante un error de red en Resend.
export async function mandarCorreo(m: Correo): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, RESEND_API_KEY: key, EMAIL_FROM: from } = config;
  if (haySmtp()) {
    try {
      await (transporte ??= nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT, secure: false, requireTLS: true, auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, connectionTimeout: 10_000, socketTimeout: 20_000,
        // Una conexión que se reutiliza: abrir y autenticar una nueva por cada correo hace que Gmail responda «Too many login attempts»
        // cuando salen varios seguidos (el código de ingreso y el QR de recuperación, por ejemplo).
        pool: true, maxConnections: 1, maxMessages: 100,
      }))
        .sendMail({
          from: `"CorePresupuesto" <${from ?? SMTP_USER}>`, to: m.to, subject: m.subject, text: m.text, ...(m.html && { html: m.html }),
          ...(m.attachment && { attachments: [{ filename: m.attachment.filename, content: m.attachment.content, contentType: m.attachment.contentType ?? 'application/pdf', ...(m.attachment.cid && { cid: m.attachment.cid }) }] }),
        });
      return;
    } catch (e) {
      console.error('[correo] fallo SMTP:', (e as { code?: string }).code ?? '', (e as Error).message);
      throw fail();
    }
  }
  if (!key || !from) throw fail('El envío por correo no está configurado.');
  const body = JSON.stringify({
    from, to: [m.to], subject: m.subject, text: m.text, ...(m.html && { html: m.html }),
    ...(m.attachment && { attachments: [{ filename: m.attachment.filename, content: m.attachment.content.toString('base64'), ...(m.attachment.cid && { content_id: m.attachment.cid }) }] }),
  });
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      if (res.status < 400 || res.status >= 500) continue;
      break; // un 4xx no se arregla reintentando
    } catch {
      /* error de red: un reintento */
    }
  }
  throw fail();
}

export const sendMail: SendMail = (m) => mandarCorreo(m);
