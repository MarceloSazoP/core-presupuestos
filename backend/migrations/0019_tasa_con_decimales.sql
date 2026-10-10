-- Tasas de impuesto con dos decimales (Contrato BD §24): Puerto Rico cobra un IVU de 11,5 %. Los presupuestos existentes no
-- cambian (19 pasa a 19.00) y el CHECK entre 0 y 100 se mantiene.
ALTER TABLE quotes ALTER COLUMN vat_rate TYPE numeric(5,2);
