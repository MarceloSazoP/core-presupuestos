-- La firma es una opción del perfil (Contrato BD §17), no de cada presupuesto.
ALTER TABLE users
  ADD COLUMN include_signature boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT users_signature_check CHECK (NOT include_signature OR signature_file_id IS NOT NULL);

ALTER TABLE quotes DROP COLUMN include_signature;
