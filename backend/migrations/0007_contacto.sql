-- Datos de contacto del profesional que salen en los presupuestos (Contrato BD §16). NULL = usar el teléfono y el correo de la cuenta.
ALTER TABLE users
  ADD COLUMN contact_phone text CHECK (contact_phone IS NULL OR contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  ADD COLUMN contact_email text CHECK (contact_email IS NULL OR (contact_email = lower(contact_email) AND length(contact_email) <= 254));
