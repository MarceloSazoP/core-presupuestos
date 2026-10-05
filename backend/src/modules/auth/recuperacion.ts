import QRCode from 'qrcode';
import { withTx } from '../../db';
import { randomToken, sha256 } from '../../lib/crypto';
import type { SendMail } from '../../lib/mail';

// QR de recuperación de la cuenta (Recuperación de cuenta con QR.md): una credencial de un solo uso que llega al correo de la
// cuenta y permite entrar en un teléfono nuevo sin saber el número. Se guarda solo su hash y hay a lo sumo uno vigente.
export const ESQUEMA = 'corepresupuesto://recuperar/';
export const tokenDe = (qr: string) => (qr.startsWith(ESQUEMA) ? qr.slice(ESQUEMA.length) : qr);

type Motivo = 'registro' | 'pedido' | 'uso';
const ASUNTO: Record<Motivo, string> = {
  registro: 'Tu QR para recuperar tu cuenta de CORE Presupuestos',
  pedido: 'Tu nuevo QR para recuperar tu cuenta de CORE Presupuestos',
  uso: 'Se usó tu QR de recuperación: este es el siguiente',
};
const INTRO: Record<Motivo, string> = {
  registro: 'Gracias por registrarte. Guarda este correo: el QR adjunto te permite volver a entrar si pierdes o cambias de teléfono, aunque no recuerdes el número.',
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
    const png = await QRCode.toBuffer(ESQUEMA + token, { margin: 2, width: 480 });
    await sendMail({
      to: u.email,
      subject: ASUNTO[motivo],
      text: [
        `Hola ${u.name}:`,
        '',
        INTRO[motivo],
        '',
        'Cómo usarlo en un teléfono nuevo:',
        '1. Instala CORE Presupuestos y abre la app.',
        '2. Toca «Entrar con el QR de mi correo» y apunta la cámara a la imagen adjunta (ábrela en el computador u otra pantalla).',
        '3. Si no puedes escanearlo, elige «Escribir el código» y pega este código:',
        '',
        token,
        '',
        'Cuida este correo: quien tenga el QR o el código puede entrar a tu cuenta. Se puede usar una sola vez y, al usarlo, te llega uno nuevo.',
      ].join('\n'),
      attachment: { filename: 'qr-recuperacion.png', content: png, contentType: 'image/png' },
    });
    return { email: u.email };
  });
}
