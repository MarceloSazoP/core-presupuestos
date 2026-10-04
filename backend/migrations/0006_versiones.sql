-- Versiones de un presupuesto rechazado (Contrato BD §15). Los presupuestos existentes son la versión 1.
ALTER TABLE quotes
  ADD COLUMN version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN parent_quote_id uuid REFERENCES quotes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT quotes_version_parent_check CHECK ((version = 1) = (parent_quote_id IS NULL));

-- Un rechazado se rehace una sola vez: cada presupuesto tiene a lo más una versión siguiente.
CREATE UNIQUE INDEX quotes_parent_idx ON quotes (parent_quote_id) WHERE parent_quote_id IS NOT NULL;
