# CorePresupuesto — Contrato de API

**Versión:** 0.2 (decisiones cerradas, pendiente de revisión final)
**Fecha:** 2026-10-03
**Depende de:** `Contrato de Base de Datos.md` (estados, transiciones, permisos, límites).
**Base:** `/api/v1` · JSON UTF-8 · fechas en ISO 8601 UTC (`timestamptz`) y `YYYY-MM-DD` para `date` · dinero en **CLP enteros**.

Web y Mobile consumen esta misma API. Las reglas de negocio (totales, estados, validaciones) viven solo en el backend.

---

## 1. Convenciones

### Autenticación

`Authorization: Bearer <token>` en todo lo que no sea `/auth/*` ni `/public/*`.
Hay dos tipos de sesión: `USER` (acceso completo a lo propio) y `QUOTE_EDIT` (un solo presupuesto, ver §9).

### Errores

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Datos inválidos",
             "details": [{ "field": "items[0].quantity", "message": "Debe ser mayor que 0" }] } }
```

| HTTP | `code` | Cuándo |
|------|--------|--------|
| 400 | `INVALID_JSON` | Cuerpo mal formado |
| 401 | `UNAUTHENTICATED` | Token ausente, inválido, vencido o revocado |
| 403 | `INSUFFICIENT_SCOPE` | Sesión válida pero sin permiso para esa operación (p. ej. `QUOTE_EDIT` intentando finalizar) |
| 404 | `NOT_FOUND` | No existe **o pertenece a otro usuario** |
| 409 | `INVALID_STATE` | Operación no permitida en el estado actual (editar un `FINALIZED`, enviar sin finalizar) |
| 409 | `ID_CONFLICT` | El `id` enviado pertenece a otro usuario |
| 409 | `CUSTOMER_HAS_QUOTES` | Borrar un cliente con presupuestos |
| 413 | `FILE_TOO_LARGE` | Supera el límite del contrato de BD §8 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Tipo de archivo no admitido |
| 422 | `VALIDATION_FAILED` | Campos inválidos (con `details`) |
| 429 | `RATE_LIMITED` | Demasiados intentos (cabecera `Retry-After`) |
| 500 | `INTERNAL` | Error no esperado; nunca expone detalles internos |

### Idempotencia y offline

- Todo `POST` que crea un recurso acepta un `id` UUID opcional generado por el cliente.
- Si el `id` ya existe para el mismo usuario, responde **200** con el recurso existente (reintento); si es de otro usuario, **409 `ID_CONFLICT`**.
- Los `PUT` de reemplazo (`items`, `measurements`, `survey`) son idempotentes por naturaleza.

### Paginación

`?limit=` (1–100, defecto 20) y `?offset=`. Respuesta: `{ "data": [...], "total": 42 }`.

### Rate limits (valores iniciales, ajustables)

| Ruta | Límite |
|------|--------|
| `POST /auth/start` | 3 por teléfono/hora y 10 por IP/hora |
| `POST /auth/verify` | 5 intentos por desafío |
| `POST /access/edit/exchange` | 10 por IP/hora |
| `GET /public/*` | 60 por IP/minuto |
| `POST /quotes/{id}/send-email` | 10 por usuario/hora |

---

## 2. Recursos

**Customer**
```json
{ "id": "uuid", "name": "Juan Pérez", "phone": "+56912345678", "email": null,
  "address": "Av. X 1234", "created_at": "…", "updated_at": "…" }
```

**QuoteSummary** (listados)
```json
{ "id": "uuid", "number": null, "customer": { "id": "uuid", "name": "Juan Pérez" },
  "service_description": "Mantención calefont", "total": 20000,
  "doc_status": "PENDING", "commercial_status": "NONE",
  "next_contact_date": null, "sent_at": null, "updated_at": "…" }
```

**Quote** (detalle)
```json
{ "id": "uuid", "number": null, "doc_status": "DRAFT", "commercial_status": "NONE",
  "customer": { "…Customer…" },
  "service_description": "", "address": null, "latitude": null, "longitude": null,
  "survey": {
    "notes": null, "field_observations": null,
    "measurements": [{ "id": "uuid", "label": "Largo", "value": "3,5 m" }],
    "photos":      [{ "id": "uuid", "url": "/files/uuid", "caption": null, "created_at": "…" }],
    "voice_notes": [{ "id": "uuid", "url": "/files/uuid", "duration_seconds": 42, "created_at": "…" }]
  },
  "items": [{ "id": "uuid", "description": "", "quantity": 1, "unit_price": 5000, "line_total": 5000 }],
  "subtotal": 0, "discount": 0, "total": 0,
  "warranty": { "kind": "NONE", "text": null },
  "validity_days": null, "observations": null,
  "include_signature": false, "include_qr": false,
  "next_contact_date": null,
  "finalized_at": null, "sent_at": null, "accepted_at": null,
  "public_url": null,
  "created_at": "…", "updated_at": "…" }
```

`warranty.kind` ∈ `NONE | D7 | D15 | D30 | M3 | M6 | Y1 | CUSTOM`. `public_url` solo existe si está `FINALIZED`.

**FollowUp**
```json
{ "id": "uuid", "note": "Revisará con su socio", "next_contact_date": "2026-10-15",
  "commercial_status": "SENT", "created_at": "…" }
```

---

## 3. Autenticación

### `POST /auth/start`
Inicia registro **o** ingreso. El cliente siempre envía los tres datos del onboarding.

```json
{ "phone": "+56912345678", "name": "Pedro Soto", "email": "pedro@mail.cl", "channel": "SMS" }
```

- `channel`: `SMS` | `EMAIL`.
- Si el teléfono **no existe**: se registra con `name` y `email` al verificar.
- Si **existe**: `name` y `email` se ignoran y el código se envía al **contacto guardado** (SMS al teléfono, correo al email guardado), nunca a uno enviado en la petición.
- La respuesta es idéntica en ambos casos (no revela si la cuenta existe).

**202**
```json
{ "challenge_id": "uuid", "expires_in_seconds": 600, "destination_masked": "p***@mail.cl" }
```
Errores: 422, 429.

### `POST /auth/verify`
```json
{ "challenge_id": "uuid", "code": "123456" }
```
**200**
```json
{ "token": "…", "expires_at": "…", "is_new_user": true,
  "user": { "id": "uuid", "name": "Pedro Soto", "phone": "+56912345678", "email": "pedro@mail.cl",
            "has_logo": false, "has_signature": false } }
```
Errores: 401 `UNAUTHENTICATED` (código incorrecto, vencido o agotado), 429. Sesión: 90 días móviles.

### `POST /auth/logout` → **204** (revoca la sesión actual)

---

## 4. Perfil

| Método y ruta | Descripción |
|---------------|-------------|
| `GET /me` | Perfil del usuario. |
| `PUT /me` | `{ "name": "…" }`. El teléfono y el correo **no se cambian** en el MVP. |
| `PUT /me/logo` | `multipart/form-data`, campo `file` (PNG/JPEG ≤ 2 MB). Reemplaza el anterior. |
| `DELETE /me/logo` | **204** |
| `PUT /me/signature` | Igual que el logo. |
| `DELETE /me/signature` | **204** |

---

## 5. Clientes

| Método y ruta | Descripción |
|---------------|-------------|
| `GET /customers?q=&limit=&offset=` | Busca por nombre o teléfono (coincidencia parcial, sin distinguir mayúsculas). |
| `POST /customers` | `{ id?, name, phone, email?, address? }` → **201** `Customer`. |
| `GET /customers/{id}` | `Customer` + `"summary": { "quotes": 3, "accepted": 2, "follow_up": 1 }`. |
| `PUT /customers/{id}` | Reemplaza `name, phone, email, address`. |
| `DELETE /customers/{id}` | **204**; **409 `CUSTOMER_HAS_QUOTES`** si tiene presupuestos. |

El historial del cliente es `GET /quotes?customer_id={id}`.

---

## 6. Presupuestos

Todo se escribe solo si `doc_status ∈ {DRAFT, PENDING}`; en `FINALIZED` responde **409 `INVALID_STATE`** (salvo lo indicado en §7 y §8).

### Listado y detalle

| Método y ruta | Descripción |
|---------------|-------------|
| `GET /quotes` | Filtros: `section` = `pending` \| `follow_up` \| `finalized`; `doc_status`; `commercial_status`; `customer_id`. Orden `updated_at` descendente. Devuelve `QuoteSummary`. |
| `GET /quotes/{id}` | `Quote` completo. |
| `GET /quotes/{id}/pdf` | PDF del snapshot. Solo `FINALIZED`. |
| `DELETE /quotes/{id}` | **204**. Solo `DRAFT`/`PENDING`. |

`section` aplica las definiciones del contrato de BD §4.

### Etapa 1 — crear y editar cabecera

**`POST /quotes`** → **201** `Quote` en `DRAFT`.
```json
{ "id": "uuid?", "customer_id": "uuid",
  "service_description": "Mantención calefont", "address": "Av. X 1234",
  "latitude": -33.45, "longitude": -70.66 }
```
Alternativa: en vez de `customer_id`, un objeto `"customer": { name, phone, email?, address? }` crea el cliente y el presupuesto en una sola transacción.

**`PATCH /quotes/{id}`** — campos parciales; solo los enviados cambian.
`customer_id, service_description, address, latitude, longitude, discount, warranty {kind, text}, validity_days, observations, include_signature, include_qr`.
`latitude` y `longitude` van juntas o ninguna. El backend recalcula `total`.

### Etapa 2 — levantamiento

| Método y ruta | Cuerpo / descripción |
|---------------|----------------------|
| `PUT /quotes/{id}/survey` | `{ "notes": "…", "field_observations": "…" }` |
| `PUT /quotes/{id}/measurements` | `{ "measurements": [{ "id"?, "label": "Largo", "value": "3,5 m" }] }` — reemplaza la lista completa y su orden. |
| `POST /quotes/{id}/photos` | `multipart`: `file`, `id?`, `caption?` → **201** foto. |
| `DELETE /quotes/{id}/photos/{photoId}` | **204** |
| `POST /quotes/{id}/voice-notes` | `multipart`: `file`, `duration_seconds`, `id?` → **201** nota de voz. |
| `DELETE /quotes/{id}/voice-notes/{noteId}` | **204** |
| `GET /files/{fileId}` | Descarga autenticada (solo el dueño). |

### Etapa 3 — ítems

**`PUT /quotes/{id}/items`** — reemplaza la lista completa y su orden.
```json
{ "items": [
  { "id": "uuid?", "description": "Pilas grandes", "quantity": 1, "unit_price": 5000 },
  { "description": "Limpiar chispero", "quantity": 1, "unit_price": 5000 } ] }
```
Responde `Quote` con `line_total`, `subtotal` y `total` calculados. `line_total = round(quantity × unit_price)`, redondeo hacia arriba en `.5`.

### Guardar

**`POST /quotes/{id}/save`** → `DRAFT → PENDING` (acción "Guardar" / "Guardar y salir"). Valida solo lo mínimo: que exista `customer` con nombre y teléfono. Sobre un `PENDING` no cambia nada y devuelve 200.

---

## 7. Finalizar y enviar

**Finalizar y enviar son operaciones distintas.** Finalizar no marca el presupuesto como enviado.

### `POST /quotes/{id}/finalize`
Acción "TERMINAR Y ENVIAR", primera mitad. Desde `DRAFT` o `PENDING`.

Valida (422 con `details`):
- `service_description` presente.
- Cliente con nombre y teléfono.
- Al menos 1 ítem, cada uno con `quantity > 0` y `unit_price ≥ 0`.
- `discount ≤ subtotal`.
- `validity_days` definido.
- `warranty.kind = CUSTOM` ⇒ `warranty.text` presente.
- `include_signature = true` ⇒ el usuario tiene firma guardada.

En **una transacción**: asigna `number` (`CP-AAAA-NNNN`), construye el snapshot, genera el PDF (con QR si `include_qr`), crea el enlace público, pone `FINALIZED` con `commercial_status = NONE`. Si algo falla, no queda nada a medias.

**200** → `Quote` con `public_url`, `number`, `finalized_at`.

### `POST /quotes/{id}/send-email`
Solo `FINALIZED`. Envía correo con mensaje, PDF adjunto y enlace público.
```json
{ "to": "cliente@mail.cl", "message": "Hola Juan, te adjunto el presupuesto." }
```
`to` es opcional; por defecto, el correo del cliente. Si no hay ninguno, 422. Solo si el envío resulta exitoso registra el envío (ver abajo).

### `POST /quotes/{id}/mark-sent`
Para WhatsApp y las opciones de compartir del dispositivo, que ocurren en el teléfono. El cliente llama a este endpoint **después** de que el usuario confirma el envío.
```json
{ "channel": "WHATSAPP" }
```
`channel`: `WHATSAPP` | `SHARE` | `LINK`.

**Registrar el envío** (en ambos endpoints): si `commercial_status = NONE` pasa a `SENT` y se fija `sent_at`; si ya estaba enviado no cambia el estado ni `sent_at`. En ambos casos se escribe `QUOTE_SENT` en la auditoría con el canal. Si el usuario genera el presupuesto y no lo envía, queda `FINALIZED + NONE`.

### `GET /quotes/{id}/share`
Solo `FINALIZED`. Devuelve `{ "public_url": "…", "qr_url": "/quotes/{id}/qr.png" }` para armar el mensaje de WhatsApp o compartir el QR.

### `GET /quotes/{id}/qr.png`
Solo `FINALIZED`. PNG del QR que apunta a `public_url`. Es un acceso de consulta: no da permisos de edición.

---

## 8. Seguimiento comercial

Disponible solo si `commercial_status ≠ NONE` (el presupuesto ya fue enviado).

### `PUT /quotes/{id}/commercial-status`
```json
{ "status": "ACCEPTED", "note": "Aprobó por WhatsApp" }
```
`status` ∈ `SENT | FOLLOW_UP | ACCEPTED | REJECTED`. Transiciones y efectos según el contrato de BD §4. Si viene `note`, se crea además una entrada en `follow_ups`.

### `GET /quotes/{id}/follow-ups` → `{ "data": [FollowUp] }` (más reciente primero)

### `POST /quotes/{id}/follow-ups`
```json
{ "note": "Revisará con su socio", "next_contact_date": "2026-10-15" }
```
Al menos uno de los dos campos. Si viene `next_contact_date` (hoy o futura) actualiza `quotes.next_contact_date` en la misma transacción. No se puede programar contacto en `ACCEPTED` ni `REJECTED`.

### `DELETE /quotes/{id}/next-contact` → **204** (limpia la fecha programada)

Las acciones "Llamar", "Abrir WhatsApp" y "Descargar PDF" las resuelve el cliente con las capacidades del dispositivo y `GET /quotes/{id}/pdf`; no requieren endpoints propios.

---

## 9. Acceso del profesional por enlace privado

Para recuperar un presupuesto editable sin una sesión `USER` (Definición §35).

| Método y ruta | Quién | Descripción |
|---------------|-------|-------------|
| `POST /quotes/{id}/edit-link` | `USER` | Crea o **rota** el enlace; revoca el anterior. Responde una sola vez `{ "url": "…", "token": "…" }`. Solo `DRAFT`/`PENDING`. |
| `DELETE /quotes/{id}/edit-link` | `USER` | **204**, revoca el enlace. |
| `POST /access/edit/exchange` | anónimo | `{ "token": "…" }` → `{ "token": "<sesión QUOTE_EDIT>", "quote_id": "uuid", "expires_at": "…" }` (30 min). 404 si está revocado o el presupuesto ya no es editable. |

Una sesión `QUOTE_EDIT` puede, **solo sobre su presupuesto**: `GET /quotes/{id}`, `PATCH`, `PUT survey|measurements|items`, subir y borrar fotos y notas de voz, `POST save`, `GET /files/*` de ese presupuesto. Todo lo demás (finalizar, enviar, estado comercial, borrar, gestionar enlaces, clientes, perfil) responde **403 `INSUFFICIENT_SCOPE`**.

---

## 10. Acceso público del cliente (solo lectura)

Sin autenticación; el token de la URL es la credencial. Nunca expone `user_id`, IDs internos, levantamiento, fotos, notas, seguimiento ni datos de acceso.

### `GET /public/quotes/{token}`
**200** — el snapshot del contrato de BD §5, **sin** teléfono ni correo del cliente:
```json
{ "number": "CP-2026-0001", "finalized_at": "…", "valid_until": "2026-10-18",
  "professional": { "name": "Pedro Soto", "phone": "+56912345678", "email": "pedro@mail.cl",
                    "has_logo": true, "has_signature": false },
  "customer": { "name": "Juan Pérez" },
  "service_description": "", "service_address": null,
  "items": [], "subtotal": 0, "discount": 0, "total": 0,
  "warranty": { "kind": "M3", "text": "3 meses" }, "validity_days": 15, "observations": null,
  "pdf_url": "/public/quotes/{token}/pdf" }
```

| Ruta | Descripción |
|------|-------------|
| `GET /public/quotes/{token}/pdf` | Descarga el PDF. |
| `GET /public/quotes/{token}/assets/logo` | Logo del profesional si existe. |
| `GET /public/quotes/{token}/assets/signature` | Firma, solo si `include_signature`. |

Token inexistente o revocado ⇒ **404** idéntico (sin distinguir). Cabeceras: `Cache-Control: no-store`, `X-Robots-Tag: noindex`. Cualquier método distinto de `GET` ⇒ 405.

---

## 11. Dashboard

### `GET /dashboard`
```json
{ "counts": { "pending": 2, "follow_up": 3, "finalized": 8 },
  "pending":   [ "…hasta 5 QuoteSummary…" ],
  "follow_up": [ { "…QuoteSummary…", "days_since_sent": 5 } ],
  "finalized": [ "…hasta 5 QuoteSummary…" ] }
```
Las listas completas se piden con `GET /quotes?section=…`.

### `GET /dashboard/kpis?month=2026-10`
Opcional; la preferencia de mostrarlos la guarda el cliente.
```json
{ "month": "2026-10", "quotes_count": 12, "quoted_amount": 2850000,
  "accepted_count": 7, "accepted_amount": 1920000,
  "avg_ticket": 274285, "acceptance_rate": 0.78, "follow_up_pending": 3 }
```

| Indicador | Definición |
|-----------|-----------|
| `quotes_count`, `quoted_amount` | Presupuestos con `finalized_at` en el mes |
| `accepted_count`, `accepted_amount`, `avg_ticket` | Presupuestos con `accepted_at` en el mes; ticket = monto / cantidad |
| `acceptance_rate` | `aceptados / (aceptados + rechazados)` decididos en el mes |
| `follow_up_pending` | Tamaño de la sección Seguimiento hoy |

---

## 12. Validaciones de campos

| Campo | Regla |
|-------|-------|
| `phone` | E.164: `+` y 8–15 dígitos. El cliente normaliza antes de enviar. |
| `email` | Formato válido, ≤ 254, se guarda en minúsculas. |
| `name` | 1–120 caracteres, sin espacios en los extremos. |
| `address` | ≤ 300 |
| `service_description` | ≤ 2000 |
| `survey.notes` | ≤ 10000 |
| `survey.field_observations`, `observations` | ≤ 5000 |
| `warranty.text` | ≤ 500 |
| `measurement.label` / `value` | 1–60 |
| `item.description` | 1–300 |
| `item.quantity` | > 0, ≤ 1.000.000, hasta 3 decimales |
| `item.unit_price` | entero 0–999.999.999 |
| `discount` | entero ≥ 0 |
| `validity_days` | entero 1–365 |
| `latitude` / `longitude` | −90…90 / −180…180, ambas o ninguna |
| `next_contact_date` | fecha ≥ hoy (`America/Santiago`) |
| `follow_up.note` | ≤ 2000 |

Cualquier campo desconocido en el cuerpo se **rechaza** con 422; nunca se copia al modelo.

---

## 13. Matriz de permisos

| Operación | `USER` | `QUOTE_EDIT` | Público |
|-----------|:------:|:------------:|:-------:|
| Perfil, clientes, dashboard | ✔ | ✘ | ✘ |
| Crear presupuesto | ✔ | ✘ | ✘ |
| Leer / editar presupuesto editable | ✔ (propio) | ✔ (el suyo) | ✘ |
| Subir / borrar fotos y voz | ✔ | ✔ | ✘ |
| Guardar | ✔ | ✔ | ✘ |
| Finalizar, enviar, estado comercial, seguimiento | ✔ | ✘ | ✘ |
| Borrar presupuesto | ✔ (`DRAFT`/`PENDING`) | ✘ | ✘ |
| Crear/revocar enlace de edición | ✔ | ✘ | ✘ |
| Ver snapshot y PDF | ✔ | ✘ | ✔ (por token) |

---

## 14. Pruebas mínimas que cubre este contrato (`CLAUDE.md` §24)

- **Aislamiento:** usuario B recibe 404 en cada ruta con IDs del usuario A.
- **Estados:** `finalize` rechaza presupuestos incompletos; un `FINALIZED` rechaza todas las escrituras; `NONE → SENT` solo vía envío confirmado; `finalize` sin envío deja `FINALIZED + NONE`.
- **Totales:** `line_total`, `subtotal` y `total` con cantidades decimales y descuento.
- **Acceso público:** el token no permite editar; revocado ⇒ 404; la respuesta no contiene campos internos.
- **Enlace de edición:** el scope `QUOTE_EDIT` se limita a su presupuesto y a las operaciones de §9.
- **Autenticación:** código vencido, intento 6, respuesta idéntica para cuenta nueva y existente.
- **Idempotencia:** reintentar `POST` con el mismo `id` no duplica.

---

## 15. Decisiones cerradas (2026-10-03)

Las de numeración, corrección tras finalizar, enlace privado, datos del cliente, tasa de aceptación, eliminación de cuenta y Pendientes están en el contrato de BD §10. Para la API:

| # | Tema | Decisión |
|---|------|----------|
| 1 | Sesión | 90 días móviles. |
| 2 | `finalize` | Síncrono: genera el PDF dentro de la petición. Pasa a asíncrono solo si en móvil tarda demasiado. |
| 3 | Librería de PDF y QR | Se elige en *Arquitectura técnica*, no afecta este contrato. |
| 4 | Proveedor de SMS y de correo | Se elige en *Arquitectura técnica*. El contrato solo exige un envío de código y de correo con PDF adjunto. |
| 5 | Rate limits | Valores iniciales de §1, ajustables. |
