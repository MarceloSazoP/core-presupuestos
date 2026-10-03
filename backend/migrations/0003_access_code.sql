-- Contrato de BD v0.3 §11: el acceso del profesional pasa de "enlace de edición" a "código del presupuesto".
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM quotes) THEN
    RAISE EXCEPTION '0003 supone una base sin presupuestos; rellena quotes.short_id a mano antes de seguir';
  END IF;
END $$;

ALTER TABLE quotes
  ADD COLUMN short_id text NOT NULL UNIQUE CHECK (short_id ~ '^[0-9A-HJKMNP-TV-Z]{6}$');

-- Sesiones y accesos de edición previos dejan de existir (el enlace de edición se retira).
DELETE FROM sessions WHERE scope = 'QUOTE_EDIT';
DELETE FROM quote_access WHERE kind = 'EDIT';

ALTER TABLE sessions DROP CONSTRAINT sessions_scope_check, DROP CONSTRAINT sessions_check;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_scope_check CHECK (scope IN ('USER','QUOTE_CODE')),
  ADD CONSTRAINT sessions_quote_scope_check CHECK ((scope = 'QUOTE_CODE') = (quote_id IS NOT NULL));

ALTER TABLE quote_access
  DROP CONSTRAINT quote_access_kind_check,
  DROP CONSTRAINT quote_access_check,
  DROP CONSTRAINT quote_access_check1;
ALTER TABLE quote_access
  DROP COLUMN token_hash,
  ADD COLUMN code_hash text,
  ADD COLUMN failed_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz,
  ADD CONSTRAINT quote_access_kind_check CHECK (kind IN ('PUBLIC','CODE')),
  ADD CONSTRAINT quote_access_public_check CHECK ((kind = 'PUBLIC') = (token IS NOT NULL)),
  ADD CONSTRAINT quote_access_code_check CHECK ((kind = 'CODE') = (code_hash IS NOT NULL));
