# CorePresupuesto — Contrato de Base de Datos

**Versión:** 0.1 (borrador para revisión)
**Fecha:** 2026-10-03
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
| D7 | Tokens de sesión y de edición se guardan **hasheados** (SHA-256 de 256 bits aleatorios). El token del enlace público se guarda en claro. | El enlace público es de solo lectura y debe poder reenviarse; los de edición se muestran una sola vez. |
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
        │     ├── quote_access         (1:N)  PUBLIC / EDIT
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
  code_hash    text NOT NULL,           -- SHA-256 del código de 6 dígitos
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
```

**Reglas que el esquema no expresa (las aplica el backend):**
- `subtotal = Σ line_total` y `total = subtotal − discount`; el cliente nunca los envía.
- Al finalizar: `discount ≤ subtotal` y al menos un ítem.
- `next_contact_date` y filas de `follow_ups` se escriben en la misma transacción.
- `files.user_id` debe coincidir con el dueño del presupuesto al que se asocia el archivo.
- Borrar una foto o nota de voz borra también su fila en `files` y luego el archivo; un barrido periódico elimina archivos huérfanos del almacenamiento.

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
  "finalized_at": "2026-10-03T14:05:00Z",
  "valid_until": "2026-10-18",
  "professional": { "name": "", "phone": "", "email": "", "logo_file_id": null, "signature_file_id": null },
  "customer": { "name": "" },
  "service_description": "",
  "service_address": null,
  "items": [{ "description": "", "quantity": 1, "unit_price": 5000, "line_total": 5000 }],
  "subtotal": 0, "discount": 0, "total": 0,
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
| Profesional por enlace de edición | Sesión `QUOTE_EDIT` | Un solo presupuesto, mientras sea editable. |
| Cliente | Token `PUBLIC` en la URL | Solo lectura del snapshot y su PDF. |

### Reglas

1. **Aislamiento:** toda consulta incluye `user_id` de la sesión. Un recurso ajeno responde **404**, no 403, para no revelar su existencia.
2. El **ID del presupuesto nunca basta** para leer ni editar (CLAUDE.md §16, Definición §35).
3. Enlace de edición: 256 bits aleatorios, guardado como hash, mostrado una sola vez, rotable y revocable. Se intercambia por una sesión `QUOTE_EDIT` de 30 min limitada a ese presupuesto.
4. Enlace público: 192 bits aleatorios, revocable. Se crea al finalizar y deja de funcionar si se revoca.
5. El token público **no permite editar**; el QR apunta a esa misma URL.
6. Códigos de verificación: 6 dígitos generados con `crypto.randomInt`, hasheados, vigencia 10 min, máximo 5 intentos.
7. Archivos solo se sirven por la API con autorización; las claves de almacenamiento nunca son públicas.
8. Secretos y credenciales solo por variables de entorno.

### Eventos de auditoría (`audit_events.event`)

`AUTH_CODE_SENT`, `LOGIN`, `LOGOUT`, `QUOTE_CREATED`, `QUOTE_FINALIZED`, `QUOTE_SENT` (metadata: canal), `COMMERCIAL_STATUS_CHANGED` (metadata: de/a), `QUOTE_DELETED`, `EDIT_LINK_CREATED`, `EDIT_LINK_USED`, `EDIT_LINK_REVOKED`, `PUBLIC_LINK_REVOKED`.

---

## 7. Eliminación y retención

| Dato | Regla |
|------|-------|
| Presupuesto `DRAFT`/`PENDING` | El dueño puede borrarlo (borrado físico en cascada, incluidos sus archivos). |
| Presupuesto `FINALIZED` | **No se elimina** en el MVP: se conserva la versión enviada. |
| Cliente | Solo se elimina si no tiene presupuestos (`ON DELETE RESTRICT`). |
| `auth_challenges` | Se purgan a las 24 h. |
| `sessions` | Se purgan al vencer o ser revocadas. |
| `audit_events` | 12 meses (propuesto). |
| Eliminación de cuenta | Fuera del MVP; ver preguntas abiertas. |

---

## 8. Archivos y límites (propuestos, ajustables)

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

## 10. Preguntas abiertas

1. **Numeración:** elegí `CP-AAAA-NNNN` por usuario (como en Definición §11). La vista online de Definición §22 muestra `CP-8F42K`. ¿Cuál queda?
2. **Corregir tras finalizar:** un `FINALIZED` es inmutable. ¿Se necesita "duplicar como nuevo presupuesto" en el MVP? No está en la doc, así que no lo incluí.
3. **Acceso del profesional:** Definición §35 permite "ID + código privado" **o** enlace privado. Implementé solo el enlace privado; el código se puede sumar después.
4. **Datos del cliente en la vista pública y el PDF:** el enlace puede reenviarse, así que el snapshot incluye solo nombre y dirección del servicio, sin teléfono ni correo. ¿Lo confirmas?
5. **Tasa de aceptación:** definí `aceptados / (aceptados + rechazados)` del mes. ¿Prefieres `aceptados / enviados`?
6. **Eliminación de cuenta y retención:** sin definición legal; queda fuera del MVP hasta decidirla.
7. **Límites de §8:** son propuestas mías, sin respaldo en la doc.
8. **Dashboard "Pendientes":** incluye `DRAFT`. Si prefieres solo `PENDING`, hay que decidir qué pasa con los borradores abandonados.
