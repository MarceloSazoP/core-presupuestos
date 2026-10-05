-- Varios países (Contrato BD §21, decisión del 2026-10-04). Lo existente queda como Chile con la hora de Santiago.
ALTER TABLE users
  ADD COLUMN country  char(2) NOT NULL DEFAULT 'CL',
  ADD COLUMN timezone text    NOT NULL DEFAULT 'America/Santiago';

ALTER TABLE quotes
  ADD COLUMN country   char(2)  NOT NULL DEFAULT 'CL',
  ADD COLUMN currency  char(3)  NOT NULL DEFAULT 'CLP',
  ADD COLUMN vat_label text     NOT NULL DEFAULT 'IVA',
  ADD COLUMN vat_rate  smallint NOT NULL DEFAULT 19 CHECK (vat_rate BETWEEN 0 AND 100);
