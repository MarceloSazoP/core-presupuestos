-- Unidad de medida por ítem (m², m³, galón, ...). El catálogo permitido lo valida la API.
ALTER TABLE quote_items
  ADD COLUMN unit text NOT NULL DEFAULT 'un' CHECK (unit ~ '^[a-z0-9]{1,16}$');
