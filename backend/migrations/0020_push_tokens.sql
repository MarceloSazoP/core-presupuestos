-- Tokens de notificación push de los teléfonos (Contrato BD §25): el aviso «tu cliente aceptó» llega aunque la app esté cerrada.
-- Un token es de un teléfono; si ahí entra otra cuenta, pasa a ella. Se borran con la cuenta.
CREATE TABLE push_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
