-- IVA opcional en el presupuesto (Contrato BD §13). Los presupuestos existentes quedan sin IVA y con el mismo total.
ALTER TABLE quotes
  ADD COLUMN include_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN vat bigint NOT NULL DEFAULT 0 CHECK (vat >= 0);

ALTER TABLE quotes DROP CONSTRAINT quotes_check1; -- CHECK (total = subtotal - discount)
ALTER TABLE quotes
  ADD CONSTRAINT quotes_total_check CHECK (total = subtotal - discount + vat),
  ADD CONSTRAINT quotes_vat_needs_flag_check CHECK (include_vat OR vat = 0);
