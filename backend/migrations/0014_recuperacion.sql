-- QR de recuperación de la cuenta (Contrato BD §23, decisión del 2026-10-05).
CREATE TABLE recovery_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,               -- sha256 del token; el token nunca se guarda
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  revoked_at timestamptz
);
CREATE INDEX recovery_tokens_vigentes ON recovery_tokens (user_id) WHERE used_at IS NULL AND revoked_at IS NULL;
