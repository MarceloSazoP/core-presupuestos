-- Garantía de por vida (Contrato BD §22, decisión del 2026-10-05).
ALTER TABLE quotes DROP CONSTRAINT quotes_warranty_kind_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_warranty_kind_check
  CHECK (warranty_kind IN ('NONE','D7','D15','D30','M3','M6','Y1','LIFETIME','CUSTOM'));
