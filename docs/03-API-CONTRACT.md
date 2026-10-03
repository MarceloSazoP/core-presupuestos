# CorePresupuesto - API Contract

**Fecha:** 2026-10-03  
**Base URL:** `/api/v1`  
**Autenticación:** Bearer token (from verification code)

---

## Autenticación

### POST /auth/request-code
Solicitar código de verificación.

**Request:**
```json
{
  "phone_or_email": "string",
  "method": "SMS" | "EMAIL"
}
```

**Response:** `200 OK`
```json
{
  "expires_in_seconds": 600,
  "message": "Código enviado"
}
```

---

### POST /auth/verify-code
Verificar código y obtener token.

**Request:**
```json
{
  "phone_or_email": "string",
  "code": "string"
}
```

**Response:** `200 OK`
```json
{
  "token": "string",
  "user": {
    "id": "UUID",
    "name": "string",
    "email": "string",
    "phone": "string"
  }
}
```

---

## Usuarios

### PUT /users/profile
Actualizar perfil del usuario (nombre, logo, firma).

**Auth:** Required

**Request:**
```json
{
  "name": "string",
  "logo_url": "string",
  "signature_url": "string"
}
```

**Response:** `200 OK`
```json
{
  "id": "UUID",
  "name": "string",
  "email": "string",
  "phone": "string"
}
```

---

## Clientes

### GET /customers
Listar clientes del usuario autenticado.

**Auth:** Required  
**Query params:** `limit`, `offset`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "UUID",
      "name": "string",
      "phone": "string",
      "email": "string",
      "address": "string"
    }
  ],
  "total": "number"
}
```

---

### POST /customers
Crear nuevo cliente.

**Auth:** Required

**Request:**
```json
{
  "name": "string",
  "phone": "string",
  "email": "string",
  "address": "string",
  "notes": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": "UUID",
  "name": "string",
  "phone": "string",
  "email": "string"
}
```

---

### GET /customers/{id}
Obtener detalles de un cliente.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "UUID",
  "name": "string",
  "phone": "string",
  "email": "string",
  "address": "string",
  "notes": "string"
}
```

---

### PUT /customers/{id}
Actualizar cliente.

**Auth:** Required

---

## Presupuestos

### GET /quotes
Listar presupuestos del usuario.

**Auth:** Required  
**Query:** `customer_id`, `doc_status`, `commercial_status`, `limit`, `offset`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "UUID",
      "quote_number": "string",
      "customer_id": "UUID",
      "customer_name": "string",
      "total": "number",
      "doc_status": "DRAFT | PENDING | FINALIZED",
      "commercial_status": "NONE | SENT | FOLLOW_UP | ACCEPTED | REJECTED",
      "created_at": "ISO8601",
      "finalized_at": "ISO8601 | null"
    }
  ],
  "total": "number"
}
```

---

### POST /quotes
Crear nuevo presupuesto.

**Auth:** Required

**Request:**
```json
{
  "customer_id": "UUID",
  "title": "string",
  "description": "string",
  "service_location": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": "UUID",
  "quote_number": "string",
  "doc_status": "DRAFT",
  "commercial_status": "NONE"
}
```

---

### GET /quotes/{id}
Obtener detalles de presupuesto.

**Auth:** Required (o public_access_key)

**Response:** `200 OK`
```json
{
  "id": "UUID",
  "quote_number": "string",
  "customer": { "id", "name", "email", "phone", "address" },
  "doc_status": "DRAFT",
  "commercial_status": "NONE",
  "items": [
    {
      "id": "UUID",
      "description": "string",
      "quantity": "number",
      "unit_price": "number",
      "line_total": "number"
    }
  ],
  "survey": {
    "notes": "string",
    "gps_latitude": "number",
    "gps_longitude": "number",
    "photos": [{ "id", "url", "caption" }],
    "voice_notes": [{ "id", "url", "duration_seconds" }]
  },
  "subtotal": "number",
  "discount": "number",
  "total": "number",
  "warranty": "string",
  "validity_days": "number",
  "created_at": "ISO8601"
}
```

---

### PUT /quotes/{id}
Actualizar presupuesto (solo propietario).

**Auth:** Required

**Request:**
```json
{
  "title": "string",
  "description": "string",
  "warranty": "string",
  "validity_days": "number",
  "notes": "string"
}
```

---

### POST /quotes/{id}/items
Agregar ítem a presupuesto.

**Auth:** Required

**Request:**
```json
{
  "description": "string",
  "quantity": "number",
  "unit_price": "number"
}
```

**Response:** `201 Created`

---

### PUT /quotes/{id}/items/{item_id}
Actualizar ítem.

**Auth:** Required

---

### DELETE /quotes/{id}/items/{item_id}
Eliminar ítem.

**Auth:** Required

---

### POST /quotes/{id}/survey
Guardar información de levantamiento.

**Auth:** Required

**Request:**
```json
{
  "notes": "string",
  "measurements": "string | object",
  "gps_latitude": "number",
  "gps_longitude": "number",
  "gps_address": "string"
}
```

---

### POST /quotes/{id}/photos
Agregar fotografía.

**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Fields:**
- `photo` — Archivo
- `caption` — Texto (opcional)

---

### POST /quotes/{id}/voice-notes
Agregar grabación de voz.

**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Fields:**
- `audio` — Archivo
- `duration_seconds` — Número

---

### POST /quotes/{id}/finalize
Finalizar presupuesto (cambiar de DRAFT a FINALIZED).

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "UUID",
  "doc_status": "FINALIZED",
  "finalized_at": "ISO8601"
}
```

---

### POST /quotes/{id}/send
Marcar como enviado y generar claves de acceso.

**Auth:** Required

**Request:**
```json
{
  "send_via": "EMAIL" | "WHATSAPP" | "LINK_ONLY"
}
```

**Response:** `200 OK`
```json
{
  "id": "UUID",
  "commercial_status": "SENT",
  "sent_at": "ISO8601",
  "public_url": "string",
  "qr_code_url": "string"
}
```

---

### GET /quotes/{id}/pdf
Descargar PDF.

**Auth:** Required (o public_access_key)

**Response:** `200 OK` (application/pdf)

---

## Seguimiento

### GET /quotes/{id}/follow-ups
Obtener historial de seguimiento.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "UUID",
      "next_contact_date": "DATE",
      "notes": "string",
      "contact_method": "CALL | WHATSAPP | EMAIL",
      "created_at": "ISO8601"
    }
  ]
}
```

---

### POST /quotes/{id}/follow-ups
Registrar seguimiento.

**Auth:** Required

**Request:**
```json
{
  "next_contact_date": "DATE",
  "notes": "string",
  "contact_method": "CALL | WHATSAPP | EMAIL"
}
```

---

### PUT /quotes/{id}/commercial-status
Cambiar estado comercial.

**Auth:** Required

**Request:**
```json
{
  "status": "NONE | SENT | FOLLOW_UP | ACCEPTED | REJECTED"
}
```

---

## Acceso Público

### GET /public/quotes/{public_access_key}
Ver presupuesto por enlace público (solo lectura).

**Auth:** None (clave pública en URL)

**Response:** Mismo que `GET /quotes/{id}` pero sin opciones de edición

---

## Errores Comunes

### 401 Unauthorized
- Token expirado
- Token inválido
- Token no enviado

### 403 Forbidden
- Usuario intenta acceder a recurso de otro usuario
- Recurso no pertenece al usuario

### 404 Not Found
- Recurso no existe
- O no tiene acceso (no distinguir por seguridad)

### 422 Unprocessable Entity
- Validación fallida
- Campo requerido faltante

---

## Notas

- Todos los endpoints autenticados requieren header: `Authorization: Bearer {token}`
- Las fechas deben ser ISO8601
- Las monedas son DECIMAL(12,2) — siempre incluir en respuesta
- El paginado usa `limit` y `offset`
- Las claves públicas (`public_access_key`) NO se envían en respuestas a usuarios no autenticados
- Los errores deben incluir `message` y opcionalmente `details`
