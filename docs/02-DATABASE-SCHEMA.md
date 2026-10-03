# CorePresupuesto - Database Schema

**Fecha:** 2026-10-03  
**Base de datos:** PostgreSQL  
**Usuario:** postgres  

---

## Tablas Principales

### users
Profesionales independientes/pequeños prestadores.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  signature_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Campos:**
- `id` — Identificador único
- `phone` — Teléfono (único, usado en verificación)
- `email` — Email (único)
- `name` — Nombre del profesional
- `logo_url` — URL del logo (opcional)
- `signature_url` — URL de la firma (opcional, imagen)
- `created_at` — Fecha de registro
- `updated_at` — Última actualización

---

### customers
Clientes del profesional.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
```

**Campos:**
- `id` — Identificador único
- `user_id` — Propietario (profesional)
- `name` — Nombre del cliente
- `phone` — Teléfono
- `email` — Email
- `address` — Dirección
- `notes` — Observaciones
- `created_at`, `updated_at` — Auditoría

---

### quotes
Presupuestos comerciales.

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- Estados
  doc_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT | PENDING | FINALIZED
  commercial_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  -- NONE | SENT | FOLLOW_UP | ACCEPTED | REJECTED
  
  -- Información básica
  quote_number VARCHAR(50) UNIQUE,
  title VARCHAR(255),
  description TEXT,
  service_location TEXT,
  
  -- Datos comerciales
  subtotal DECIMAL(12, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  
  -- Términos
  warranty TEXT,
  validity_days INT DEFAULT 30,
  notes TEXT,
  
  -- Acceso
  public_access_key VARCHAR(64) UNIQUE,
  edit_access_key VARCHAR(64) UNIQUE,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  sent_at TIMESTAMP,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_doc_status ON quotes(doc_status);
CREATE INDEX idx_quotes_commercial_status ON quotes(commercial_status);
```

**Campos:**
- Estados separados: documental (`DRAFT`, `PENDING`, `FINALIZED`) y comercial (`NONE`, `SENT`, `FOLLOW_UP`, `ACCEPTED`, `REJECTED`)
- `public_access_key` — Acceso público de solo lectura
- `edit_access_key` — Acceso privado para editar
- `validity_days` — Días de vigencia (default 30)

---

### quote_items
Ítems (líneas) del presupuesto.

```sql
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
```

---

### quote_survey
Información de levantamiento (notas, mediciones).

```sql
CREATE TABLE quote_survey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
  
  notes TEXT,
  measurements TEXT, -- JSON o texto estructurado
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  gps_address TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX idx_survey_quote_id ON quote_survey(quote_id);
```

---

### quote_photos
Fotografías del levantamiento.

```sql
CREATE TABLE quote_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  
  photo_url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX idx_photos_quote_id ON quote_photos(quote_id);
```

---

### quote_voice_notes
Grabaciones de voz.

```sql
CREATE TABLE quote_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  
  audio_url TEXT NOT NULL,
  duration_seconds INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX idx_voice_notes_quote_id ON quote_voice_notes(quote_id);
```

---

### follow_ups
Seguimiento comercial.

```sql
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  next_contact_date DATE,
  notes TEXT,
  contact_method VARCHAR(20), -- CALL | WHATSAPP | EMAIL
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_follow_ups_quote_id ON follow_ups(quote_id);
CREATE INDEX idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX idx_follow_ups_next_contact ON follow_ups(next_contact_date);
```

---

### verification_codes
Códigos de verificación temporal.

```sql
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_or_email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  attempt_count INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_phone_or_email ON verification_codes(phone_or_email);
CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);
```

---

### audit_log
Log básico de cambios (opcional pero recomendado).

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(50), -- CREATE | UPDATE | DELETE
  changes JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
```

---

## Relaciones Principales

```
users
  ├── customers (1:N)
  │   └── quotes (1:N)
  │       ├── quote_items (1:N)
  │       ├── quote_survey (1:1)
  │       ├── quote_photos (1:N)
  │       ├── quote_voice_notes (1:N)
  │       └── follow_ups (1:N)
  │
  └── follow_ups (1:N)

verification_codes
  └── (temporal, sin FK)
```

---

## Permisos y Aislamiento

### Regla Fundamental
**Un usuario NUNCA puede ver ni modificar datos de otro usuario.**

- `quotes` SIEMPRE filtrado por `user_id = current_user`
- `customers` SIEMPRE filtrado por `user_id = current_user`
- `follow_ups` SIEMPRE filtrado por `user_id = current_user`

### Acceso Público
- Leer `quotes` por `public_access_key` (solo lectura, sin autenticación)
- Leer `quote_items` si quote es pública
- Leer `quote_photos` si quote es pública

### Acceso Privado
- Editar `quotes` por `edit_access_key` + autenticación
- O editar si `user_id = current_user`

---

## Transiciones de Estado

### Documental
```
DRAFT → PENDING → FINALIZED
(hacia atrás también permitido hasta FINALIZED)
```

### Comercial
```
NONE → SENT → FOLLOW_UP
       ↓
    ACCEPTED | REJECTED
```

---

## Notas

- Usar UUID para todo (seguridad, no exposición de IDs secuenciales)
- Las fotografías y grabaciones se almacenan en object storage (S3, Azure, local), no en BD
- Los URLs apuntan a esas ubicaciones
- `public_access_key` debe ser único y opaco (no UUID, algo como `PQRST123UVWX456`)
- `edit_access_key` debe ser único, opaco y más largo que el público
