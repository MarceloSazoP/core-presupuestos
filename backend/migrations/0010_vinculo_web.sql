-- Vínculo de la web con la app por QR (Contrato BD §19): la portada muestra un QR por visita y la app lo escanea.
CREATE TABLE web_pairings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash     text NOT NULL UNIQUE,
  secret_hash   text NOT NULL,
  expires_at    timestamptz NOT NULL,
  quote_id      uuid REFERENCES quotes(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text,
  claimed_at    timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((claimed_at IS NULL) = (quote_id IS NULL))
);
CREATE INDEX web_pairings_expires_idx ON web_pairings (expires_at);
