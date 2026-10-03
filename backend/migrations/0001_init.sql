-- Orden de creación respetando dependencias.

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          text NOT NULL UNIQUE CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),   -- E.164, identidad de la cuenta
  email          text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  logo_file_id      uuid,   -- FK a files, se agrega abajo
  signature_file_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  phone       text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email       text CHECK (email IS NULL OR (email = lower(email) AND length(email) <= 254)),
  address     text CHECK (length(address) <= 300),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)                       -- habilita la FK compuesta de quotes
);
CREATE INDEX customers_user_name_idx  ON customers (user_id, lower(name));
CREATE INDEX customers_user_phone_idx ON customers (user_id, phone);
-- Sin UNIQUE (user_id, phone): dos clientes pueden compartir teléfono. La app sugiere coincidencias al buscar.

CREATE TABLE quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL,
  number              text,                                   -- 'CP-2026-0001', asignado al finalizar
  doc_status          text NOT NULL DEFAULT 'DRAFT'
                      CHECK (doc_status IN ('DRAFT','PENDING','FINALIZED')),
  commercial_status   text NOT NULL DEFAULT 'NONE'
                      CHECK (commercial_status IN ('NONE','SENT','FOLLOW_UP','ACCEPTED','REJECTED')),

  -- Etapa 1
  service_description text CHECK (length(service_description) <= 2000),
  address             text CHECK (length(address) <= 300),    -- lugar del trabajo (distinto de customers.address)
  latitude            numeric(9,6) CHECK (latitude  BETWEEN -90  AND 90),
  longitude           numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),

  -- Etapa 3 (totales los calcula siempre el backend)
  subtotal            bigint NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount            bigint NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total               bigint NOT NULL DEFAULT 0,
  warranty_kind       text NOT NULL DEFAULT 'NONE'
                      CHECK (warranty_kind IN ('NONE','D7','D15','D30','M3','M6','Y1','CUSTOM')),
  warranty_text       text CHECK (length(warranty_text) <= 500),
  validity_days       int  CHECK (validity_days BETWEEN 1 AND 365),
  observations        text CHECK (length(observations) <= 5000),   -- aparecen en el PDF
  include_signature   boolean NOT NULL DEFAULT false,
  include_qr          boolean NOT NULL DEFAULT false,

  -- Seguimiento
  next_contact_date   date,                                   -- única fuente de verdad del próximo contacto
  finalized_at        timestamptz,
  sent_at             timestamptz,                            -- primer envío/compartición confirmado
  accepted_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quotes_customer_fk FOREIGN KEY (customer_id, user_id)
    REFERENCES customers (id, user_id) ON DELETE RESTRICT,
  UNIQUE (user_id, number),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (total = subtotal - discount),
  CHECK (warranty_kind <> 'CUSTOM' OR warranty_text IS NOT NULL),
  CHECK ((doc_status = 'FINALIZED') = (finalized_at IS NOT NULL)),
  CHECK ((doc_status = 'FINALIZED') = (number IS NOT NULL)),
  CHECK (doc_status = 'FINALIZED' OR commercial_status = 'NONE'),
  CHECK ((commercial_status = 'NONE') = (sent_at IS NULL)),
  CHECK ((commercial_status = 'ACCEPTED') = (accepted_at IS NOT NULL)),
  -- Exigencias de un presupuesto emitido
  CHECK (doc_status <> 'FINALIZED' OR (service_description IS NOT NULL
                                       AND validity_days IS NOT NULL
                                       AND total >= 0))
);
CREATE INDEX quotes_user_status_idx   ON quotes (user_id, doc_status, updated_at DESC);
CREATE INDEX quotes_user_customer_idx ON quotes (user_id, customer_id);
CREATE INDEX quotes_user_followup_idx ON quotes (user_id, commercial_status, next_contact_date);

CREATE TABLE quote_counters (            -- numeración CP-AAAA-NNNN por usuario y año
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        int  NOT NULL,
  last_number int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);

CREATE TABLE files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id    uuid REFERENCES quotes(id) ON DELETE CASCADE,   -- NULL solo para LOGO y SIGNATURE
  kind        text NOT NULL CHECK (kind IN ('LOGO','SIGNATURE','PHOTO','VOICE','PDF')),
  storage_key text NOT NULL UNIQUE,                           -- u/{user_id}/q/{quote_id}/{file_id}.{ext}
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL CHECK (size_bytes > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind IN ('LOGO','SIGNATURE')) = (quote_id IS NULL))
);
ALTER TABLE users
  ADD FOREIGN KEY (logo_file_id)      REFERENCES files(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (signature_file_id) REFERENCES files(id) ON DELETE SET NULL;

-- Levantamiento (Etapa 2) ----------------------------------------------------
CREATE TABLE quote_surveys (
  quote_id          uuid PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,
  notes             text CHECK (length(notes) <= 10000),
  field_observations text CHECK (length(field_observations) <= 5000),   -- internas; no van al PDF
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE survey_measurements (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id  uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position  int  NOT NULL,
  label     text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),   -- 'Largo'
  value     text NOT NULL CHECK (length(value) BETWEEN 1 AND 60),   -- '3,5 m' (texto libre, sin unidades formales)
  UNIQUE (quote_id, position)
);

CREATE TABLE survey_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  file_id    uuid NOT NULL UNIQUE REFERENCES files(id) ON DELETE CASCADE,
  caption    text CHECK (length(caption) <= 200),
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE survey_voice_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  file_id          uuid NOT NULL UNIQUE REFERENCES files(id) ON DELETE CASCADE,
  duration_seconds int  NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Presupuesto (Etapa 3) ------------------------------------------------------
CREATE TABLE quote_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 300),
  quantity    numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price  bigint NOT NULL CHECK (unit_price BETWEEN 0 AND 999999999),
  line_total  bigint NOT NULL CHECK (line_total = round(quantity * unit_price)),
  UNIQUE (quote_id, position)
);

CREATE TABLE quote_documents (          -- existe solo si doc_status = 'FINALIZED'
  quote_id    uuid PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,
  snapshot    jsonb NOT NULL,           -- ver §5
  pdf_file_id uuid NOT NULL REFERENCES files(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quote_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('PUBLIC','EDIT')),
  token      text UNIQUE,               -- solo PUBLIC (192 bits, base64url)
  token_hash text UNIQUE,               -- solo EDIT (SHA-256 hex de 256 bits)
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'PUBLIC') = (token IS NOT NULL)),
  CHECK ((kind = 'EDIT')   = (token_hash IS NOT NULL))
);
CREATE UNIQUE INDEX quote_access_active_idx ON quote_access (quote_id, kind) WHERE revoked_at IS NULL;

CREATE TABLE follow_ups (               -- bitácora de seguimiento (solo se agrega)
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note              text CHECK (length(note) <= 2000),
  next_contact_date date,
  commercial_status text NOT NULL,      -- estado del presupuesto al registrar
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (note IS NOT NULL OR next_contact_date IS NOT NULL)
);
CREATE INDEX follow_ups_quote_idx ON follow_ups (quote_id, created_at DESC);

-- Autenticación --------------------------------------------------------------
CREATE TABLE auth_challenges (          -- código SMS/correo, existe antes que el usuario
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,           -- identidad
  channel      text NOT NULL CHECK (channel IN ('SMS','EMAIL')),
  destination  text NOT NULL,           -- a dónde se envió realmente (ver API: auth/start)
  signup_name  text,                    -- solo si el usuario no existía
  signup_email text,
  code_hash    text NOT NULL,           -- HMAC-SHA256 del código de 6 dígitos con pepper del servidor
  attempts     int  NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_challenges_phone_idx ON auth_challenges (phone, created_at DESC);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  scope        text NOT NULL DEFAULT 'USER' CHECK (scope IN ('USER','QUOTE_EDIT')),
  quote_id     uuid REFERENCES quotes(id) ON DELETE CASCADE,   -- solo QUOTE_EDIT
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'QUOTE_EDIT') = (quote_id IS NOT NULL))
);

CREATE TABLE audit_events (             -- auditoría mínima, solo se agrega
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  quote_id   uuid,                      -- sin FK: sobrevive al borrado del presupuesto
  event      text NOT NULL,             -- ver §6
  metadata   jsonb,
  ip         inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_user_idx  ON audit_events (user_id, created_at DESC);
CREATE INDEX audit_events_quote_idx ON audit_events (quote_id, created_at DESC);
