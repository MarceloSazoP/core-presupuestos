import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    WEB_BASE_URL: z.string().url().default('http://localhost:3012'),
    CORS_ORIGINS: z.string().default(''),
    STORAGE_DIR: z.string().default('./storage'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Verificación por código (Arquitectura §3, Autenticación)
    AUTH_CODE_PEPPER: z.string().min(16, 'debe tener al menos 16 caracteres'),
    SMS_DAILY_CAP: z.coerce.number().int().min(0).default(200),
    OTP_LOG_CODES: bool,

    // Proveedores: opcionales en desarrollo, obligatorios en producción
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV !== 'production') return;
    if (c.OTP_LOG_CODES) ctx.addIssue({ code: 'custom', path: ['OTP_LOG_CODES'], message: 'no puede estar activo en producción' });
    for (const k of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'RESEND_API_KEY', 'EMAIL_FROM'] as const) {
      if (!c[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'obligatoria en producción' });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  throw new Error(`Configuración inválida:\n  ${detail}`);
}

export const config = parsed.data;
