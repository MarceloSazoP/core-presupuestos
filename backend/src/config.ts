import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3013),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    WEB_BASE_URL: z.string().url().default('http://localhost:3012'),
    CORS_ORIGINS: z.string().default(''),
    STORAGE_DIR: z.string().default('./storage'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Verificación por código (Arquitectura §3, Autenticación)
    AUTH_CODE_PEPPER: z.string().min(16, 'debe tener al menos 16 caracteres'),
    SMS_DAILY_CAP: z.coerce.number().int().min(0).default(200),
    // Solicitudes por hora y por IP a `POST /auth/start` y a `POST /auth/recovery` (10 en producción). En desarrollo, probando el ingreso
    // una y otra vez, se agota rápido: se puede subir en el .env.
    AUTH_IP_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(10),
    OTP_LOG_CODES: bool,

    // Proveedores: opcionales en desarrollo, obligatorios en producción
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    // Alternativa a Resend: SMTP (p. ej. Gmail con contraseña de aplicación). Pensado para desarrollo y pruebas.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV !== 'production') return;
    if (c.OTP_LOG_CODES) ctx.addIssue({ code: 'custom', path: ['OTP_LOG_CODES'], message: 'no puede estar activo en producción' });
    for (const k of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'] as const) {
      if (!c[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'obligatoria en producción' });
    }
    // El correo puede ir por Resend o por SMTP, pero alguno debe estar completo.
    const resend = !!c.RESEND_API_KEY && !!c.EMAIL_FROM;
    const smtp = !!c.SMTP_HOST && !!c.SMTP_USER && !!c.SMTP_PASSWORD;
    if (!resend && !smtp) ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'en producción hace falta Resend (RESEND_API_KEY y EMAIL_FROM) o SMTP' });
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  throw new Error(`Configuración inválida:\n  ${detail}`);
}

export const config = parsed.data;
