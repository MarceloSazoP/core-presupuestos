import 'server-only';
import nodemailer from 'nodemailer';
import { clp } from './formato';
import type { Finalizado } from './presupuestos';
import { calcularTotales } from './totales';

export class ErrorCorreo extends Error {}

function transporte() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) throw new ErrorCorreo('El correo no está configurado.');
  return {
    desde: SMTP_USER,
    smtp: nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: false,
      requireTLS: true,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    }),
  };
}

export async function enviarPresupuesto(p: Finalizado, pdf: Buffer): Promise<void> {
  if (!p.cliente.correo) throw new ErrorCorreo('El cliente no tiene correo.');
  const { total } = calcularTotales(p.items, p.descuento);
  const { desde, smtp } = transporte();
  try {
    await smtp.sendMail({
      from: `"CorePresupuesto" <${desde}>`,
      to: p.cliente.correo,
      subject: `Presupuesto ${p.numero}`,
      text:
        `Hola ${p.cliente.nombre},\n\n` +
        `Te enviamos el presupuesto ${p.numero} por ${clp(total)} (${p.descripcion}).\n` +
        `Lo encuentras adjunto en PDF. Tiene una validez de ${p.validezDias} días.\n\n` +
        `Este es un presupuesto comercial, no un documento tributario.`,
      attachments: [{ filename: `${p.numero}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
  } catch (err) {
    console.error('[correo] fallo de envío:', (err as Error).message);
    throw new ErrorCorreo('No se pudo enviar el correo.');
  }
}
