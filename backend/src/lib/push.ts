import { config } from '../config';
import { query } from '../db';

// Notificaciones push (Arquitectura §5, «Aviso de aceptación»): por el servicio de Expo, que las reparte a FCM (Android) y APNs
// (iPhone). Sin SDK: un POST. Un aviso es una ayuda: si falla, se registra y no se propaga.
export type AvisoPush = { title: string; body: string; data: Record<string, unknown> };
export type EnviarPush = (userId: string, aviso: AvisoPush) => Promise<void>;

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

export const enviarPush: EnviarPush = async (userId, aviso) => {
  const { rows } = await query<{ token: string }>('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
  if (!rows.length) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(config.EXPO_ACCESS_TOKEN && { Authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}` }) },
      // `channelId`: el canal que la app crea en Android antes de registrarse (sin canal, Android no muestra el aviso).
      body: JSON.stringify(rows.map((r) => ({ to: r.token, title: aviso.title, body: aviso.body, data: aviso.data, sound: 'default', channelId: 'default', priority: 'high' }))),
      signal: AbortSignal.timeout(10_000),
    });
    const tickets = ((await res.json().catch(() => ({}))) as { data?: Ticket[] }).data ?? [];
    // Un teléfono que ya no recibe avisos (app desinstalada) no se vuelve a intentar.
    const muertos = rows.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered').map((r) => r.token);
    if (muertos.length) await query('DELETE FROM push_tokens WHERE token = ANY($1)', [muertos]);
  } catch (e) {
    console.error('[push] no se pudo enviar el aviso:', (e as Error).message);
  }
};
