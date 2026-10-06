-- Códigos para confirmar la eliminación de la cuenta (docs/Exportar y eliminar la cuenta.md, Contrato BD §7).
CREATE TABLE account_deletion_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,            -- HMAC-SHA256 del código de 6 dígitos con el pepper, atado a `id`
  attempts    int  NOT NULL DEFAULT 0,  -- se invalida al 5.º intento fallido
  expires_at  timestamptz NOT NULL,     -- 10 minutos
  consumed_at timestamptz,              -- usado o reemplazado por otro pedido
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_deletion_codes_user_idx ON account_deletion_codes (user_id, created_at DESC);
