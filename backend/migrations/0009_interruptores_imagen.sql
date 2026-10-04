-- Un interruptor por imagen del perfil (Contrato BD §18): encendido habilita subirla y usarla en todos los presupuestos.
ALTER TABLE users DROP CONSTRAINT users_signature_check; -- se puede encender antes de subir la imagen
ALTER TABLE users ADD COLUMN use_logo boolean NOT NULL DEFAULT false;

-- Quien ya tenía imagen la sigue usando.
UPDATE users SET use_logo = true WHERE logo_file_id IS NOT NULL;
UPDATE users SET include_signature = true WHERE signature_file_id IS NOT NULL;
