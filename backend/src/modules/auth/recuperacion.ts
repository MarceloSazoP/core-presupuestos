import QRCode from 'qrcode';
import { withTx } from '../../db';
import { randomToken, sha256 } from '../../lib/crypto';
import type { SendMail } from '../../lib/mail';

// QR de recuperación de la cuenta (Recuperación de cuenta con QR.md): una credencial de un solo uso que llega al correo de la
// cuenta y permite entrar en un teléfono nuevo sin saber el número. Se guarda solo su hash y hay a lo sumo uno vigente.
export const ESQUEMA = 'corepresupuesto://recuperar/';
export const tokenDe = (qr: string) => (qr.startsWith(ESQUEMA) ? qr.slice(ESQUEMA.length) : qr);

const CID = 'qr-recuperacion'; // el nombre con que el HTML cita la imagen incrustada
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Motivo = 'registro' | 'ingreso' | 'pedido' | 'uso';
const ASUNTO: Record<Motivo, string> = {
  registro: 'Tu QR para recuperar tu cuenta de CORE Presupuestos',
  ingreso: 'Tu QR para recuperar tu cuenta de CORE Presupuestos',
  pedido: 'Tu nuevo QR para recuperar tu cuenta de CORE Presupuestos',
  uso: 'Se usó tu QR de recuperación: este es el siguiente',
};
const INTRO: Record<Motivo, string> = {
  registro: 'Gracias por registrarte. Guarda este correo: el QR adjunto te permite volver a entrar si pierdes o cambias de teléfono, aunque no recuerdes el número.',
  ingreso: 'Entraste a tu cuenta y todavía no tenías un QR de recuperación, así que te enviamos uno. Guarda este correo: el QR adjunto te permite volver a entrar si pierdes o cambias de teléfono, aunque no recuerdes el número.',
  pedido: 'Pediste un QR de recuperación nuevo. El anterior ya no sirve.',
  uso: 'Alguien entró a tu cuenta con tu QR de recuperación (si fuiste tú al cambiar de teléfono, no tienes que hacer nada). Ese QR ya no sirve; este es el siguiente.',
};

// Revoca el QR vigente, crea uno nuevo y lo envía al correo de la cuenta, todo o nada: si el correo no sale, el anterior sigue valiendo.
// El correo se envía antes de confirmar; una falla (502) deshace el cambio.
export async function enviarQrRecuperacion(userId: string, sendMail: SendMail, motivo: Motivo): Promise<{ email: string }> {
  return withTx(async (c) => {
    const { rows } = await c.query<{ name: string; email: string }>('SELECT name, email FROM users WHERE id = $1', [userId]);
    const u = rows[0]!;
    const token = randomToken();
    await c.query('UPDATE recovery_tokens SET revoked_at = now() WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL', [userId]);
    await c.query('INSERT INTO recovery_tokens (user_id, token_hash) VALUES ($1, $2)', [userId, sha256(token)]);
    const png = await QRCode.toBuffer(ESQUEMA + token, { margin: 2, width: 560 });
    const nombre = escapar(u.name);
    await sendMail({
      to: u.email,
      subject: ASUNTO[motivo],
      text: [
        `Hola ${u.name}:`,
        '',
        INTRO[motivo],
        '',
        'Qué hacer si cambias de teléfono:',
        '1. Instala CORE Presupuestos en el teléfono nuevo y ábrela.',
        '2. Toca «Entrar con el QR de mi correo».',
        '3. Apunta la cámara al cuadro con puntitos (el QR) que está en este correo. Mejor abre este correo en el computador.',
        '4. Si no se puede escanear, toca «Escribir el código» y copia este código:',
        '',
        token,
        '',
        'Guarda este correo y no lo compartas: quien tenga el QR o el código puede entrar a tu cuenta. Sirve una sola vez; al usarlo, te llega uno nuevo.',
      ].join('\n'),
      // El mismo contenido con letra grande: el QR a la vista, listo para escanear, y los pasos cortos y en orden.
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.5;color:#0B1B3A;max-width:560px;margin:0 auto;padding:16px">
  <p style="font-size:22px;margin:0 0 12px"><strong>Hola ${nombre}:</strong></p>
  <p style="margin:0 0 20px">${escapar(INTRO[motivo])}</p>
  <div style="text-align:center;margin:0 0 20px;padding:16px;border:2px solid #0E3578;border-radius:16px">
    <p style="margin:0 0 8px"><strong>Este es tu QR</strong></p>
    <img src="cid:${CID}" alt="QR para recuperar tu cuenta" width="300" height="300" style="width:300px;height:300px;max-width:100%" />
    <p style="margin:8px 0 0;font-size:16px;color:#4F5B74">Apunta la cámara de la app a este cuadro.</p>
  </div>
  <p style="margin:0 0 8px"><strong>Qué hacer si cambias de teléfono</strong></p>
  <ol style="margin:0 0 20px;padding-left:24px">
    <li>Instala <strong>CORE Presupuestos</strong> en el teléfono nuevo y ábrela.</li>
    <li>Toca <strong>«Entrar con el QR de mi correo»</strong>.</li>
    <li>Apunta la cámara al cuadro de arriba. Es más fácil si abres este correo en el computador.</li>
  </ol>
  <p style="margin:0 0 8px"><strong>¿No se puede escanear?</strong> Toca «Escribir el código» y copia este:</p>
  <p style="margin:0 0 20px;padding:12px;background:#F3F5FA;border-radius:8px;font-family:Courier New,monospace;font-size:16px;word-break:break-all">${token}</p>
  <p style="margin:0;font-size:16px;color:#4F5B74">Guarda este correo y no lo compartas: quien tenga el QR o el código puede entrar a tu cuenta. Sirve una sola vez; al usarlo, te llega uno nuevo.</p>
</div>`,
      attachment: { filename: 'qr-recuperacion.png', content: png, contentType: 'image/png', cid: CID },
    });
    return { email: u.email };
  });
}
