# CorePresupuesto — Contrato de Base de Datos

**Versión:** 0.3 (acceso por código; pendiente de revisión)
**Fecha:** 2026-10-03

> **Cambio v0.3:** el acceso del profesional deja de ser un "enlace privado de edición" y pasa a ser un **código del presupuesto** (`ID corto + secreto`, §6). Lo crea el servidor al crear el presupuesto, lo muestra la app móvil y se escribe en la caja "Consultar presupuesto" de la web. Reemplaza `quote_access.kind = 'EDIT'` y `sessions.scope = 'QUOTE_EDIT'`. La migración `0001` no se edita: el cambio entra como `0003` (§11).
**Motor:** PostgreSQL 14+ · **Base:** `core-prespuestos` (local) · credenciales solo por `DATABASE_URL`
**Fuentes:** `CLAUDE.md`, `Definición Funcional del Producto — v1.0`, `Alcance Exacto del MVP`, `Reemplazo de las secciones 11 a 17 (Wizard)`.

Este contrato **reemplaza la sección 25 (Modelo de datos MVP) de `Alcance Exacto del MVP.md`**, que define `jobs`, `job_photos`, `job_notes` y `job_measurements` y contradice `CLAUDE.md` (§2.2 y §9: no existe entidad `Trabajo`). El documento de Alcance debe actualizarse; no lo modifiqué.

---

## 1. Decisiones de modelo

| # | Decisión | Motivo |
|---|----------|--------|
| D1 | No existe `jobs`. El **presupuesto se crea en la Etapa 1** (estado `DRAFT`) y el levantamiento cuelga de él (`quote_surveys`, medidas, fotos, voz). | El levantamiento existe antes de que haya ítems o precios (estado Pendiente) y `CLAUDE.md` prohíbe `Trabajo`. |
| D2 | Dinero en **CLP como `bigint`** (pesos enteros, sin decimales). Cantidad `numeric(12,3)`. `line_total = round(quantity × unit_price)`. | Chile no usa decimales; evita errores de punto flotante. |
| D3 | IDs **UUID**. El cliente (mobile offline) puede generarlos. | Captura offline sin colisiones ni IDs predecibles. |
| D4 | Estado documental y comercial en **columnas separadas**, con `CHECK` que impiden combinaciones inválidas. | `CLAUDE.md` §12. |
| D5 | Al finalizar se guarda un **snapshot inmutable** (`quote_documents`) del que salen PDF y vista pública. | "Fija una versión comercial"; editar perfil o cliente después no altera lo enviado. |
| D6 | Aislamiento por usuario con `user_id` en las tablas raíz y **FK compuesta** `quotes(customer_id, user_id) → customers(id, user_id)`. | Un presupuesto no puede apuntar a un cliente de otro usuario ni por error. |
| D7 | Tokens de sesión se guardan **hasheados** (SHA-256 de 256 bits aleatorios). El **secreto del código** se guarda con **Argon2id** (es corto y lo teclea una persona, así que necesita un hash lento). El token del enlace público se guarda en claro. | El enlace público es de solo lectura y debe poder reenviarse; el secreto del código se muestra una sola vez. |
| D9 | Cada presupuesto tiene un **ID corto** (`quotes.short_id`, 6 caracteres, no secreto, indexable) que forma la primera mitad del código. | Argon2id lleva sal y no se puede buscar por hash: el ID corto localiza la fila y el secreto se verifica contra ella. |
| D8 | `updated_at` lo mantiene la aplicación (sin triggers). | Menos piezas. |

---

## 2. Diagrama de relaciones

```text
users ──┬── customers ──┐
        │               │ (customer_id, user_id)
        ├── quotes ◄────┘
        │     ├── quote_surveys        (1:1)  notas + observaciones de terreno
        │     ├── survey_measurements  (1:N)
        │     ├── survey_photos        (1:N) ── files
        │     ├── survey_voice_notes   (1:N) ── files
        │     ├── quote_items          (1:N)
        │     ├── quote_documents      (1:1)  snapshot + PDF (solo FINALIZED) ── files
        │     ├── quote_access         (1:N)  PUBLIC / CODE
        │     └── follow_ups           (1:N)
        ├── files (logo, firma, y archivos de cada presupuesto)
        ├── sessions
        └── audit_events
auth_challenges (previa a la existencia del usuario)
quote_counters  (numeración por usuario y año)
```

---

## 3. Definición de tablas

```sql
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
  short_id            text NOT NULL UNIQUE                    -- primera mitad del código (v0.3, D9)
                      CHECK (short_id ~ '^[0-9A-HJKMNP-TV-Z]{6}$'),   -- alfabeto Crockford base32 (sin I, L, O, U)
  number              text,                                   -- 'CP-2026-0001', asignado al finalizar
  version             int NOT NULL DEFAULT 1 CHECK (version >= 1),       -- v0.4: 2.ª, 3.ª versión de un rechazado
  parent_quote_id     uuid REFERENCES quotes(id) ON DELETE RESTRICT,     -- el presupuesto rechazado del que viene
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
  include_vat         boolean NOT NULL DEFAULT false,            -- v0.4: agrega el IVA (19 %) sobre subtotal − descuento
  vat                 bigint NOT NULL DEFAULT 0 CHECK (vat >= 0),
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
  CHECK ((version = 1) = (parent_quote_id IS NULL)),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (total = subtotal - discount + vat),
  CHECK (include_vat OR vat = 0),
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
  kind        text NOT NULL DEFAULT 'ITEM' CHECK (kind IN ('ITEM','TASK')),  -- v0.4: TASK = actividad sin cantidad ni unidad
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 300),
  quantity    numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price  bigint NOT NULL CHECK (unit_price BETWEEN 0 AND 999999999),
  line_total  bigint NOT NULL CHECK (line_total = round(quantity * unit_price)),
  UNIQUE (quote_id, position),
  CHECK (kind = 'ITEM' OR quantity = 1)
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
  kind       text NOT NULL CHECK (kind IN ('PUBLIC','CODE')),
  token      text UNIQUE,               -- solo PUBLIC (192 bits, base64url)
  code_hash  text,                      -- solo CODE: Argon2id (cadena PHC) del secreto de 10 caracteres
  failed_attempts int NOT NULL DEFAULT 0,   -- solo CODE: intentos fallidos seguidos
  locked_until    timestamptz,              -- solo CODE: bloqueo temporal tras 5 fallos
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'PUBLIC') = (token IS NOT NULL)),
  CHECK ((kind = 'CODE')   = (code_hash IS NOT NULL))
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
  scope        text NOT NULL DEFAULT 'USER' CHECK (scope IN ('USER','QUOTE_CODE')),
  quote_id     uuid REFERENCES quotes(id) ON DELETE CASCADE,   -- solo QUOTE_CODE
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'QUOTE_CODE') = (quote_id IS NOT NULL))
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
```

**Reglas que el esquema no expresa (las aplica el backend):**
- `subtotal = Σ line_total`; `vat = include_vat ? round((subtotal − discount) × 19 / 100) : 0` (solo si `subtotal − discount > 0`) y `total = subtotal − discount + vat`; el cliente nunca los envía. La tasa del 19 % vive solo en el backend y se congela en el snapshot al finalizar.
- Al finalizar: `discount ≤ subtotal` y al menos un ítem.
- `next_contact_date` y filas de `follow_ups` se escriben en la misma transacción.
- `files.user_id` debe coincidir con el dueño del presupuesto al que se asocia el archivo.
- Borrar una foto o nota de voz borra también su fila en `files` y luego el archivo; un barrido periódico elimina archivos huérfanos del almacenamiento.

---

### Cambios posteriores al esquema inicial

La migración `0001` ya está aplicada y no se edita; los cambios van en migraciones nuevas.

**0002 — unidad de medida por ítem** (`m²`, `m³`, galón, etc.). Solo exige un código corto; el catálogo permitido lo valida la API (Contrato de API §12.1), para no migrar cada vez que se agrega una unidad.

```sql
ALTER TABLE quote_items
  ADD COLUMN unit text NOT NULL DEFAULT 'un' CHECK (unit ~ '^[a-z0-9]{1,16}$');
```

---

## 4. Estados y transiciones

### Documental (`quotes.doc_status`)

```text
DRAFT ──guardar──► PENDING ──finalizar──► FINALIZED   (irreversible)
  └──────────────finalizar──────────────────►
```

| Estado | Significado | Editable |
|--------|-------------|----------|
| `DRAFT` | Wizard en curso; "Siguiente" guarda temporalmente. | Sí |
| `PENDING` | Guardado explícito ("Guardar" / "Guardar y salir"). | Sí |
| `FINALIZED` | Terminado; existen snapshot, PDF y enlace público. | **No** |

El tablero **Pendientes** muestra `DRAFT` y `PENDING` para que nada capturado en terreno quede invisible.

### Comercial (`quotes.commercial_status`)

```text
NONE ──envío confirmado──► SENT ◄──► FOLLOW_UP ◄──► ACCEPTED
                             │            │              ▲▼
                             └────────────┴──────────► REJECTED
```

- `NONE → SENT` solo por envío/compartición confirmada y solo si `FINALIZED`. Generar el PDF no cambia el estado.
- Entre `SENT`, `FOLLOW_UP`, `ACCEPTED` y `REJECTED` el cambio es **manual y libre** (permite corregir errores).
- Nunca se vuelve a `NONE`.
- Al pasar a `ACCEPTED` se fija `accepted_at`; al salir de él se limpia.
- Al pasar a `ACCEPTED` o `REJECTED` se limpia `next_contact_date`.
- Aceptar **no** crea nada más (sin Trabajo).

### Secciones del dashboard (derivadas, no almacenadas)

| Sección | Condición |
|---------|-----------|
| Pendientes | `doc_status IN ('DRAFT','PENDING')` |
| Seguimiento | `commercial_status IN ('SENT','FOLLOW_UP') AND next_contact_date <= hoy` |
| Finalizados | `doc_status = 'FINALIZED'` (los que no están en Seguimiento) |

"Hoy" se calcula en `America/Santiago`.

---

## 5. Snapshot de `quote_documents.snapshot`

Se construye en `finalize` y es lo único que leen el PDF y la vista pública.

```json
{
  "number": "CP-2026-0001",
  "version": 1,
  "previous_number": null,
  "finalized_at": "2026-10-03T14:05:00Z",
  "valid_until": "2026-10-18",
  "professional": { "name": "", "phone": "", "email": "", "logo_file_id": null, "signature_file_id": null },
  "customer": { "name": "" },
  "service_description": "",
  "service_address": null,
  "items": [{ "kind": "ITEM", "description": "", "quantity": 1, "unit": "un", "unit_price": 5000, "line_total": 5000 }],
  "subtotal": 0, "discount": 0, "include_vat": false, "vat": 0, "vat_rate": 19, "total": 0,
  "warranty": { "kind": "M3", "text": "3 meses" },
  "validity_days": 15,
  "observations": null,
  "include_signature": false,
  "include_qr": false
}
```

`valid_until = fecha de finalización + validity_days`. Fotos, notas, medidas, voz y observaciones de terreno **nunca** entran al snapshot (Definición §14: son internas).

---

## 6. Acceso, permisos y seguridad

### Actores

| Actor | Credencial | Alcance |
|-------|-----------|---------|
| Profesional | Sesión `USER` | Todo lo suyo (`user_id = sesión`). |
| Quien tiene el código del presupuesto (el profesional, o quien él lo comparta) | Sesión `QUOTE_CODE` | Un solo presupuesto: completarlo o editarlo mientras no esté finalizado, finalizarlo, enviarlo, y verlo y descargar su PDF. Nada más (API §9). |
| Cliente | Token `PUBLIC` en la URL | Solo lectura del snapshot y su PDF. |

### Reglas

1. **Aislamiento:** toda consulta incluye `user_id` de la sesión. Un recurso ajeno responde **404**, no 403, para no revelar su existencia.
2. El **ID del presupuesto nunca basta** para leer ni editar (CLAUDE.md §16, Definición §35).
3. **Código del presupuesto** `AAAAAA-BBBBBBBBBB` (alfabeto Crockford base32):
   - `AAAAAA` es `quotes.short_id` (6 caracteres, no secreto) y `BBBBBBBBBB` es el secreto (10 caracteres = 50 bits generados con `crypto.randomInt`).
   - El secreto se guarda con **Argon2id** (`quote_access.code_hash`), se muestra **una sola vez** (al crear o rotar) y es rotable y revocable. Si se pierde, el profesional entra con su cuenta y genera uno nuevo.
   - Se intercambia por una sesión `QUOTE_CODE` de 30 min limitada a ese presupuesto.
   - Defensa contra adivinación: 5 fallos seguidos sobre un mismo ID corto bloquean ese código 15 min (`locked_until`), más el límite por IP (API §1). La verificación corre aunque el ID no exista (contra un hash señuelo) para no revelar por tiempo qué códigos existen.
   - Quien tiene el código **tiene los permisos del profesional sobre ese presupuesto** (incluido finalizar y enviar). Por eso al cliente se le entrega el enlace público o el QR, no el código.
4. Enlace público: 192 bits aleatorios, revocable. Se crea al finalizar y deja de funcionar si se revoca.
5. El token público **no permite editar**; el QR apunta a esa misma URL.
6. Códigos de verificación: 6 dígitos generados con `crypto.randomInt`, hasheados, vigencia 10 min, máximo 5 intentos.
7. Archivos solo se sirven por la API con autorización; las claves de almacenamiento nunca son públicas.
8. Secretos y credenciales solo por variables de entorno.

### Eventos de auditoría (`audit_events.event`)

`AUTH_CODE_SENT`, `LOGIN`, `LOGOUT`, `QUOTE_CREATED`, `QUOTE_FINALIZED`, `QUOTE_SENT` (metadata: canal), `COMMERCIAL_STATUS_CHANGED` (metadata: de/a), `QUOTE_DELETED`, `ACCESS_CODE_CREATED` (incluye la rotación), `ACCESS_CODE_USED`, `ACCESS_CODE_FAILED` (metadata: ID corto), `ACCESS_CODE_REVOKED`, `PUBLIC_LINK_REVOKED`.

---

## 7. Eliminación y retención

| Dato | Regla |
|------|-------|
| Presupuesto `DRAFT`/`PENDING` | El dueño puede borrarlo (borrado físico en cascada, incluidos sus archivos). |
| Presupuesto `FINALIZED` | **No se elimina** en el MVP: se conserva la versión enviada. |
| Cliente | Solo se elimina si no tiene presupuestos (`ON DELETE RESTRICT`). |
| `auth_challenges` | Se purgan a las 24 h. |
| `sessions` | Se purgan al vencer o ser revocadas. |
| `audit_events` | 12 meses. |
| Eliminación de cuenta | Fuera del MVP (§10, decisión 6). |

---

## 8. Archivos y límites (valores iniciales, ajustables)

| Recurso | Límite |
|---------|--------|
| Logo / firma | PNG o JPEG, ≤ 2 MB |
| Foto | JPEG/PNG/HEIC→JPEG, ≤ 10 MB c/u, ≤ 30 por presupuesto (el móvil reduce a ~2048 px) |
| Nota de voz | AAC/M4A/MP3, ≤ 5 min y ≤ 10 MB, ≤ 5 por presupuesto |
| Ítems | ≤ 100 por presupuesto |
| Medidas | ≤ 50 por presupuesto |
| Monto | `unit_price` ≤ 999.999.999; `quantity` ≤ 1.000.000 con 3 decimales |
| PDF | Generado en `finalize`; se guarda en `files` (`kind = 'PDF'`) |

Almacenamiento del MVP: disco local detrás de una función `put/get/delete` por `storage_key`. Mover a un servicio externo no cambia el esquema.

---

## 9. Captura offline

- Mobile genera los UUID de `quotes`, `customers`, ítems, etc., sin red.
- Las escrituras de creación y las de reemplazo (`PUT`) son **idempotentes**: reintentar no duplica.
- Si un `id` ya existe para el mismo usuario, la operación se trata como reintento; si pertenece a otro, falla con 409.
- Conflictos: **gana la última escritura recibida**. No hay sincronización distribuida (CLAUDE.md §11).
- Los archivos se suben después de crear el registro; la fila del presupuesto puede existir sin sus fotos.

---

## 10. Decisiones cerradas (2026-10-03)

Cerradas con las recomendaciones del asistente por delegación del usuario; se pueden reabrir.

| # | Tema | Decisión |
|---|------|----------|
| 1 | Numeración | `CP-AAAA-NNNN` por usuario y año (Definición §11). El ejemplo `CP-8F42K` de la vista online (§22) era ilustrativo. |
| 2 | Corregir tras finalizar | `FINALIZED` es inmutable. **Reabierta el 2026-10-04:** un presupuesto **rechazado** se puede rehacer como **nueva versión** (otro presupuesto, con su código, número y PDF, que dice «Versión 2/3» y a cuál reemplaza); ver §15. Los demás siguen sin poder duplicarse. |
| 3 | Acceso del profesional | **Cambiada en v0.3:** el MVP usa **"ID + código seguro"** (Definición §35, CLAUDE.md §16) en lugar del enlace privado de edición, porque así lo definió el usuario: la app móvil crea el presupuesto y su código, y el profesional lo completa, edita o ve desde la web escribiéndolo. Se descarta el enlace privado para no mantener dos mecanismos. Quien pierda el código entra con SMS o correo y genera uno nuevo. |
| 4 | Datos del cliente en vista pública y PDF | Solo nombre del cliente y dirección del servicio; sin teléfono ni correo, porque el enlace puede reenviarse. |
| 5 | Tasa de aceptación | `aceptados / (aceptados + rechazados)` decididos en el mes. Un presupuesto sin respuesta no cuenta como rechazo. |
| 6 | Eliminación de cuenta | Fuera del MVP. Se define junto con la política de privacidad antes de publicar en tiendas. |
| 7 | Límites de §8 y retención de §7 | Se adoptan como valores iniciales del MVP; son ajustables sin cambiar el esquema. |
| 8 | Pendientes del dashboard | Incluye `DRAFT` y `PENDING`. Un borrador abandonado sigue visible hasta que el usuario lo guarde, finalice o borre. |

---

## 11. Migración `0003` (cambio v0.3: acceso por código)

Aún **no se crea el archivo**: se escribe cuando se apruebe este contrato. La diferencia respecto de `0001` es esta. No hay datos reales, así que la migración se niega a correr si ya existen presupuestos (en vez de inventar IDs cortos para filas viejas).

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM quotes) THEN
    RAISE EXCEPTION '0003 supone una base sin presupuestos; rellena quotes.short_id a mano antes de seguir';
  END IF;
END $$;

ALTER TABLE quotes
  ADD COLUMN short_id text NOT NULL UNIQUE CHECK (short_id ~ '^[0-9A-HJKMNP-TV-Z]{6}$');

-- Sesiones y accesos de edición previos dejan de existir (el enlace de edición se retira).
DELETE FROM sessions WHERE scope = 'QUOTE_EDIT';
DELETE FROM quote_access WHERE kind = 'EDIT';

ALTER TABLE sessions DROP CONSTRAINT sessions_scope_check, DROP CONSTRAINT sessions_check;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_scope_check CHECK (scope IN ('USER','QUOTE_CODE')),
  ADD CONSTRAINT sessions_quote_scope_check CHECK ((scope = 'QUOTE_CODE') = (quote_id IS NOT NULL));

ALTER TABLE quote_access DROP CONSTRAINT quote_access_kind_check, DROP CONSTRAINT quote_access_check, DROP CONSTRAINT quote_access_check1;
ALTER TABLE quote_access
  DROP COLUMN token_hash,
  ADD COLUMN code_hash text,
  ADD COLUMN failed_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz,
  ADD CONSTRAINT quote_access_kind_check CHECK (kind IN ('PUBLIC','CODE')),
  ADD CONSTRAINT quote_access_public_check CHECK ((kind = 'PUBLIC') = (token IS NOT NULL)),
  ADD CONSTRAINT quote_access_code_check CHECK ((kind = 'CODE') = (code_hash IS NOT NULL));
```

> Los nombres de las restricciones (`sessions_check`, `quote_access_check1`…) son los que Postgres asigna por defecto; se verifican con `\d` antes de escribir el archivo.

**Pruebas que acompañan a la migración:** `short_id` rechaza caracteres fuera del alfabeto y duplicados; `kind = 'CODE'` exige `code_hash`; `kind = 'PUBLIC'` exige `token`; una sesión `QUOTE_CODE` exige `quote_id`.

---

## 12. Propuesta v0.4 — identidad verificada y acceso social (borrador, no implementado)

Acompaña a `Contrato de API.md` §3.1. La migración `0007` se escribe cuando se apruebe.

```sql
-- El correo identifica la cuenta y está verificado; el teléfono es contacto y puede faltar.
ALTER TABLE users
  ADD COLUMN email_verified_at timestamptz,
  ADD COLUMN phone_verified_at timestamptz,
  ALTER COLUMN phone DROP NOT NULL,
  DROP CONSTRAINT users_phone_key;

-- Cuentas existentes (solo hay datos de desarrollo): se dan por verificadas.
UPDATE users SET email_verified_at = now(), phone_verified_at = now();
ALTER TABLE users ALTER COLUMN email_verified_at SET NOT NULL;

-- Un teléfono verificado pertenece a una sola cuenta; los no verificados pueden repetirse (nadie puede "reservar" el de otro).
CREATE UNIQUE INDEX users_phone_verified_idx ON users (phone) WHERE phone_verified_at IS NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_phone_verified_check CHECK (phone_verified_at IS NULL OR phone IS NOT NULL);

CREATE TABLE auth_identities (          -- formas de entrar con un proveedor externo
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   text NOT NULL CHECK (provider IN ('GOOGLE','APPLE')),
  subject    text NOT NULL,             -- `sub` del token: estable, no cambia aunque cambie el correo
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);
CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);

-- Los desafíos de código se identifican por correo (o por teléfono verificado), no solo por teléfono.
ALTER TABLE auth_challenges
  ADD COLUMN email text,
  ALTER COLUMN phone DROP NOT NULL,
  ADD CONSTRAINT auth_challenges_identity_check CHECK ((phone IS NOT NULL) <> (email IS NOT NULL));
CREATE INDEX auth_challenges_email_idx ON auth_challenges (email, created_at DESC);
```

- **Retención:** `auth_identities` vive mientras exista la cuenta. Las sesiones revocadas siguen purgándose como en §7.
- **Lo que deja de existir:** registrarse con un teléfono sin verificar como identidad, y `auth_challenges.signup_email` sin verificar (el correo se verifica en el mismo desafío).
- **Pruebas que acompañan:** dos cuentas pueden tener el mismo teléfono no verificado pero no el mismo verificado; `(provider, subject)` es único; no se puede dejar `phone_verified_at` sin `phone`.


---

## 13. Migración `0004` (IVA, decisión del 2026-10-04)

El usuario pidió una casilla para que el presupuesto calcule el IVA. Detalle de la regla en `Contrato de API.md` §6 (`PATCH /quotes/{id}`). Los presupuestos existentes quedan sin IVA y con el mismo total.

```sql
ALTER TABLE quotes
  ADD COLUMN include_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN vat bigint NOT NULL DEFAULT 0 CHECK (vat >= 0);

ALTER TABLE quotes DROP CONSTRAINT quotes_check2;   -- el nombre se verifica con \d antes de escribir el archivo
ALTER TABLE quotes
  ADD CONSTRAINT quotes_total_check CHECK (total = subtotal - discount + vat),
  ADD CONSTRAINT quotes_vat_needs_flag_check CHECK (include_vat OR vat = 0);
```

- Los snapshots ya creados no traen `include_vat`: se leen como `false`.
- **Pruebas que acompañan:** `total = subtotal − descuento + IVA`; con `include_vat = false` el IVA es 0; el descuento se aplica antes del IVA; el redondeo de `.5` sube; cambiar el descuento o la casilla recalcula; el snapshot, el PDF y la vista pública muestran el IVA; el esquema rechaza un total que no cuadra.


---

## 14. Migración `0005` (tareas en la grilla de ítems, decisión del 2026-10-04)

El usuario pidió poder agregar actividades como «botar escombros» o «limpiar bodega» a la grilla, con algo que las distinga de los ítems y sin cantidad ni unidad. Detalle de la regla en `Contrato de API.md` §6 («Ítems y tareas»). Las líneas existentes quedan como `ITEM`.

```sql
ALTER TABLE quote_items
  ADD COLUMN kind text NOT NULL DEFAULT 'ITEM' CHECK (kind IN ('ITEM','TASK')),
  ADD CONSTRAINT quote_items_task_check CHECK (kind = 'ITEM' OR quantity = 1);
```

- Una tarea guarda `quantity = 1` y `unit = 'un'` para no cambiar el resto del esquema (`line_total = round(quantity × unit_price)` sigue valiendo y `unit` sigue teniendo un valor); lo que la distingue es `kind`.
- Los snapshots ya creados no traen `kind` en sus ítems: se leen como `ITEM`.
- **Pruebas que acompañan:** una tarea se crea sin cantidad ni unidad y con `quantity = 1`; con cantidad o unidad responde 422; `unit_price` omitido vale 0; suma al subtotal; una tarea en 0 es «Incluido» y no cambia el total; el snapshot, la vista pública y el PDF las muestran como tarea; el esquema rechaza una tarea con cantidad distinta de 1.


---

## 15. Migración `0006` (versiones de un presupuesto rechazado, decisión del 2026-10-04)

El usuario pidió que un presupuesto rechazado pueda volver a editarse, diciendo que es una 2.ª o 3.ª versión, en el presupuesto y en el PDF. Detalle de la regla y de lo que se copia en `Contrato de API.md` §6 («Rehacer un presupuesto rechazado»). Lo enviado no se modifica: la versión nueva es **otro presupuesto**.

```sql
ALTER TABLE quotes
  ADD COLUMN version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN parent_quote_id uuid REFERENCES quotes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT quotes_version_parent_check CHECK ((version = 1) = (parent_quote_id IS NULL));

-- Un rechazado se rehace una sola vez: cada presupuesto tiene a lo más una versión siguiente.
CREATE UNIQUE INDEX quotes_parent_idx ON quotes (parent_quote_id) WHERE parent_quote_id IS NOT NULL;
```

- `version = padre.version + 1`; la cadena de versiones se sigue por `parent_quote_id`. El número `CP-AAAA-NNNN` de cada versión se asigna al terminarla, como siempre (el índice único `(user_id, number)` no cambia).
- Los snapshots ya creados no traen `version` ni `previous_number`: se leen como versión 1.
- **Pruebas que acompañan:** solo un rechazado se rehace (los demás estados dan 409); se rehace una sola vez (409 `ALREADY_REVISED`); la nueva versión copia ítems, tareas, descuento, IVA y condiciones pero no fotos ni seguimiento; `version` sube de 1 en 1; el original no cambia; el snapshot, la vista pública y el listado traen la versión; el esquema rechaza `version > 1` sin padre y dos hijos del mismo padre.
