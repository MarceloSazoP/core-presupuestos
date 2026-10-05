import { z } from 'zod';

export const phone = z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Debe ser un teléfono en formato internacional (+56912345678)');
export const email = z.string().trim().toLowerCase().max(254).email('Correo inválido');
export const name = z.string().trim().min(1, 'Obligatorio').max(120, 'Máximo 120 caracteres');

export const StartBody = z.strictObject({ phone, name, email, channel: z.enum(['SMS', 'EMAIL']) });
export const RecoveryBody = z.strictObject({ token: z.string().min(20).max(300), close_other_sessions: z.boolean().default(true) });
export const VerifyBody = z.strictObject({ challenge_id: z.uuid(), code: z.string().regex(/^\d{6}$/, 'Son 6 dígitos') });
