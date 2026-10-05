# CorePresupuesto — Contrato de API

**Versión:** 0.3 (acceso por código; pendiente de revisión)
**Fecha:** 2026-10-03

> **Cambio v0.3:** el enlace privado de edición (§9) se reemplaza por el **código del presupuesto**. La app móvil crea el presupuesto, el servidor genera su código y quien lo escribe en la caja "Consultar presupuesto" de la web obtiene una sesión limitada a ese presupuesto para completarlo, editarlo, finalizarlo, enviarlo o verlo. Detalle en §9 y en el Contrato de BD v0.3.
**Depende de:** `Contrato de Base de Datos.md` (estados, transiciones, permisos, límites).
**Base:** `/api/v1` · JSON UTF-8 · fechas en ISO 8601 UTC (`timestamptz`) y `YYYY-MM-DD` para `date` · dinero en **CLP enteros**.

Web y Mobile consumen esta misma API. Las reglas de negocio (totales, estados, validaciones) viven solo en el backend.

---

## 1. Convenciones

### Autenticación

`Authorization: Bearer <token>` en todo lo que no sea `/auth/*` ni `/public/*`.
Hay dos tipos de sesión: `USER` (acceso completo a lo propio) y `QUOTE_CODE` (un solo presupuesto, se obtiene con su código, ver §9).

### Errores

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Datos inválidos",
             "details": [{ "field": "items[0].quantity", "message": "Debe ser mayor que 0" }] } }
```

| HTTP | `code` | Cuándo |
|------|--------|--------|
| 400 | `INVALID_JSON` | Cuerpo mal formado |
| 401 | `UNAUTHENTICATED` | Token ausente, inválido, vencido o revocado |
| 403 | `INSUFFICIENT_SCOPE` | Sesión válida pero sin permiso para esa operación (p. ej. `QUOTE_CODE` intentando borrar el presupuesto) |
| 404 | `NOT_FOUND` | No existe **o pertenece a otro usuario** |
| 409 | `INVALID_STATE` | Operación no permitida en el estado actual (editar un `FINALIZED`, enviar sin finalizar) |
| 409 | `ID_CONFLICT` | El `id` enviado pertenece a otro usuario |
| 409 | `CUSTOMER_HAS_QUOTES` | Borrar un cliente con presupuestos |
| 413 | `FILE_TOO_LARGE` | Supera el límite del contrato de BD §8 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Tipo de archivo no admitido |
| 422 | `VALIDATION_FAILED` | Campos inválidos (con `details`) |
| 429 | `RATE_LIMITED` | Demasiados intentos (cabecera `Retry-After`) |
| 502 | `DELIVERY_FAILED` | No se pudo enviar el código (SMS o correo) o el correo del presupuesto. No se registra el envío |
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
| `POST /access/code/exchange` | 10 por IP/hora y, por código, 5 fallos seguidos bloquean ese código 15 min (responde 429) |
| `POST /access/pair` | 120 por IP/hora |
| `POST /access/pair/poll` | 600 por IP/hora (cada computador consulta cada 2 s mientras muestra el QR) |
| `POST /access/pair/claim` | 30 por IP/hora |
| `GET /public/*` | 60 por IP/minuto |
| `POST /quotes/{id}/send-email` | 10 por usuario/hora |

---

## 2. Recursos

**Customer**
```json
{ "id": "uuid", "name": "Juan Pérez", "phone": "+56912345678", "email": null,
  "address": "Av. X 1234", "created_at": "…", "updated_at": "…" }
```

**QuoteSummary** (listados). `code_id` es el ID corto del presupuesto (la primera parte del código): la app lo muestra en las listas como el identificador con el que el usuario reconoce y nombra cada presupuesto. No es secreto ni da acceso por sí solo.
```json
{ "id": "uuid", "code_id": "7K4M2Q", "number": null, "version": 1, "customer": { "id": "uuid", "name": "Juan Pérez" },
  "service_description": "Mantención calefont", "total": 20000, "currency": "CLP",
  "doc_status": "PENDING", "commercial_status": "NONE",
  "next_contact_date": null, "sent_at": null, "updated_at": "…" }
```

**Quote** (detalle)
```json
{ "id": "uuid", "code_id": "7K4M2Q", "number": null, "doc_status": "DRAFT", "commercial_status": "NONE",
  "version": 1, "previous_number": null, "next_version_id": null,
  "customer": { "…Customer…" },
  "professional": { "name": "Pedro Soto", "phone": "+56912345678", "email": "pedro@mail.cl", "has_logo": false },
  "service_description": "", "address": null, "latitude": null, "longitude": null,
  "survey": {
    "notes": null, "field_observations": null,
    "measurements": [{ "id": "uuid", "label": "Largo", "value": "3,5 m" }],
    "photos":      [{ "id": "uuid", "url": "/files/uuid", "caption": null, "created_at": "…" }],
    "voice_notes": [{ "id": "uuid", "url": "/files/uuid", "duration_seconds": 42, "created_at": "…" }]
  },
  "items": [{ "id": "uuid", "kind": "ITEM", "description": "", "quantity": 1, "unit": "un", "unit_price": 5000, "line_total": 5000 }],
  "subtotal": 0, "discount": 0, "include_vat": false, "vat": 0, "total": 0,
  "country": "CL", "currency": "CLP", "vat_label": "IVA", "vat_rate": 19,
  "warranty": { "kind": "NONE", "text": null },
  "validity_days": null, "observations": null,
  "include_qr": false,
  "next_contact_date": null,
  "finalized_at": null, "sent_at": null, "accepted_at": null,
  "public_url": null,
  "created_at": "…", "updated_at": "…" }
```

`professional` es quien emite el presupuesto (la web, que entra con el código y no tiene acceso a `/me`, lo necesita para su encabezado); su logo se descarga con `GET /quotes/{id}/logo` (el actual mientras se edita y el fijado en el snapshot una vez finalizado; 404 si no hay). `code_id` es la primera mitad del código (no secreta; el secreto no se puede volver a leer). `warranty.kind` ∈ `NONE | D7 | D15 | D30 | M3 | M6 | Y1 | LIFETIME | CUSTOM` (`LIFETIME` se muestra como «De por vida»). `public_url` solo existe si está `FINALIZED`.

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
- Si ni el teléfono **ni el correo** existen: se registra con `name` y `email` al verificar.
- Si **alguno de los dos existe** (coincide el teléfono o el correo de una cuenta), es un **ingreso a esa cuenta**: `name`, `phone` y `email` se ignoran y el código se envía al **contacto guardado** (SMS al teléfono, correo al email guardado), nunca a uno enviado en la petición. Así, entrar con el mismo correo pero otro teléfono no crea una persona nueva ni choca con «correo ya en uso». Si el teléfono y el correo coinciden con cuentas distintas, gana la del teléfono.
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

### 3.1 Propuesta v0.4 — identidad verificada y acceso con Google o Apple (borrador, no implementado)

**Problema que corrige.** Hoy el teléfono es la identidad de la cuenta, pero solo se verifica si el registro fue por SMS; y el correo solo se verifica si el registro fue por correo. Quien se registra por correo con el teléfono de otra persona queda dueño de esa identidad (el código de esa persona le llegaría a su correo), y quien se registra por SMS con un correo equivocado deja un correo sin verificar que luego recibe códigos de recuperación. Esta sección lo cierra y agrega el inicio de sesión social.

**Reglas**

1. La cuenta se identifica por su **correo verificado** (único). Se verifica con un código enviado a ese correo, o porque Google o Apple lo entregan ya verificado.
2. El **teléfono** pasa a ser un dato de contacto (PDF, WhatsApp). No identifica la cuenta ni sirve para ingresar mientras no esté verificado con un SMS (cuando exista Twilio). Puede repetirse entre cuentas no verificadas.
3. Google y Apple son **otras formas de entrar a la misma cuenta**, no cuentas distintas. Una cuenta puede tener varias (correo, Google, Apple).
4. Nunca se envía un código a un correo o teléfono que llegue en la petición para una cuenta que ya existe: va siempre al contacto verificado guardado.

**`POST /auth/start`** (cambia): `{ "email": "…", "name": "…" }` para correo; `{ "phone": "+56…" }` para SMS, solo si existe una cuenta con ese teléfono verificado. En ambos casos la respuesta es igual exista o no la cuenta. `name` solo se usa al crear.

**`POST /auth/social`**
```json
{ "provider": "GOOGLE", "id_token": "…", "nonce": "…", "name": "Pedro Soto" }
```
- `provider`: `GOOGLE` | `APPLE`. `nonce`: lo genera la app y debe venir dentro del token (evita reutilizarlo).
- El servidor valida firma (claves públicas del proveedor), emisor, `aud` (los identificadores de cliente de CorePresupuesto), vencimiento y `nonce`. Nunca confía en datos que envíe la app aparte del token.
- Si la identidad (`provider` + `sub`) ya existe: ingresa a esa cuenta.
- Si no existe y el correo del token está verificado y coincide con el correo verificado de una cuenta: **vincula** la identidad a esa cuenta e ingresa.
- Si no existe nada: crea la cuenta con el correo del token (en Apple puede ser una dirección de reenvío; se acepta) y `name` (Apple solo lo entrega la primera vez: la app lo envía).
- **200**: igual que `/auth/verify`, más `"needs_phone": true` si la cuenta aún no tiene teléfono. Errores: 401 `UNAUTHENTICATED` (token inválido, vencido o con otro `nonce`), 422 (el proveedor no entregó correo), 429.

**Cuenta y sesiones** (requieren sesión `USER`)

| Método y ruta | Descripción |
|---------------|-------------|
| `PUT /me` | Ahora también acepta `phone` mientras no esté verificado. |
| `GET /me/identities` | Formas de entrar: `[{ id, provider, created_at }]`. |
| `POST /me/identities` | `{ provider, id_token, nonce }`: vincula Google o Apple a la cuenta actual. |
| `DELETE /me/identities/{id}` | **204**. No permite quitar la última forma de entrar (409). |
| `GET /me/sessions` | Sesiones activas: `[{ id, created_at, last_used_at, current }]`. |
| `DELETE /me/sessions/{id}` | **204**. Cierra esa sesión (p. ej. la de un teléfono perdido). |

**Límites:** `POST /auth/social` 20 por IP/hora.
**Pruebas mínimas:** token con firma, `aud`, emisor, `nonce` o vencimiento inválidos → 401; la misma identidad entra siempre a la misma cuenta; vincular por correo solo si ambos están verificados; no se puede quitar la última identidad; cerrar una sesión ajena → 404; el correo no verificado nunca recibe códigos de ingreso.

---

## 4. Perfil

| Método y ruta | Descripción |
|---------------|-------------|
| `GET /me` | `{ id, name, phone, email, country, timezone, contact_phone, contact_email, has_logo, has_signature, use_logo, include_signature, logo_id, signature_id }`. `logo_id` y `signature_id` cambian con cada imagen nueva (o son `null`): se usan en la dirección de la imagen, p. ej. `/me/logo?v={logo_id}`, para que la app no muestre una imagen vieja guardada en caché. |
| `PUT /me` | Parcial: `{ "name"?, "country"?, "timezone"?, "contact_phone"?, "contact_email"?, "use_logo"?, "include_signature"? }` (al menos uno). `country` ∈ la lista de `GET /countries` (422 si no); `timezone` es un nombre IANA válido, como `America/Lima` (422 si no). Cambiar el país **no** modifica los presupuestos ya creados (`Internacionalización.md` §3.2). El `phone` y el `email` de la cuenta **no se cambian** en el MVP. |
| `GET /countries` | Sin sesión. Los países disponibles: `[{ country, name, currency, symbol, thousands, vat_label, vat_rate, calling_code }]`. Es la tabla de `Internacionalización.md` §2; la app la usa para elegir el país y le basta con la guardada si no hay conexión. |
| `PUT /me/logo` | `multipart/form-data`, campo `file` (PNG/JPEG ≤ 2 MB). Reemplaza el anterior. |
| `GET /me/logo` | Descarga el logo propio (404 si no hay). Es lo que muestra «Configurar». |
| `DELETE /me/logo` | **204** |
| `PUT /me/signature` | Igual que el logo. |
| `GET /me/signature` | Igual que el logo. |
| `DELETE /me/signature` | **204** |

**Firma en el PDF (decisión del 2026-10-04).** El PDF siempre cierra con un bloque de firma: una **línea** y, debajo, **«Firma:» seguido del nombre o negocio** configurado (`name`) y, en otra línea, el **teléfono y el correo de contacto** (así también sirve para firmar a mano). La **imagen de la firma** se imprime sobre la línea cuando el usuario activa `include_signature` en su perfil (el interruptor está junto a la foto de la firma, en «Configurar»). Es una opción **del perfil, no de cada presupuesto**: o va en todos o en ninguno, porque una firma que unas veces está y otras no le resta seriedad al documento.

**Un interruptor por imagen (decisión del 2026-10-04).** El logo y la firma tienen cada uno su interruptor en el perfil (`use_logo`, `include_signature`). **Encendido** habilita subir la imagen y se usa en todos los presupuestos que se terminen; **apagado** no se usa en ninguno (la app oculta la subida) pero la imagen subida se conserva. Encender no exige tener ya la imagen: puede encenderse primero y subirla después. **Subir una imagen enciende su interruptor**; borrarla lo deja como está. El logo y la firma que se imprimen son los del perfil **al terminar** el presupuesto y quedan fijados en su snapshot: cambiar los interruptores o las imágenes después no altera lo ya enviado. Sirve para cualquier país: no lleva identificadores tributarios ni nada propio de un país (el teléfono va en formato internacional); lo único que depende de la región es la moneda y el IVA del presupuesto, que hoy son los de Chile. La firma es una imagen comercial: no es una firma electrónica avanzada.

**Datos de contacto (decisión del 2026-10-04).** `phone` y `email` son la identidad de la cuenta (con ellos se ingresa) y no cambian. `contact_phone` y `contact_email` son los datos que salen en los presupuestos, el PDF, la vista pública y el correo al cliente; el usuario los configura desde «Configurar» en la app y valen `null` mientras no los cambie (entonces se usan `phone` y `email`). `name` es el nombre que sale en los presupuestos: puede ser el de un negocio («Instalaciones R. Sazo»). Al terminar un presupuesto sus datos de contacto, su nombre y su logo **quedan fijados** en el snapshot: cambiarlos después no altera lo ya enviado. `contact_phone` va en formato internacional como `phone`; `null` vuelve a usar el de la cuenta.

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
| `GET /quotes/{id}/preview` | **Vista previa** (decisión del 2026-10-04): el PDF del borrador tal como quedaría con lo guardado hoy, con marca de agua «VISTA PREVIA». No numera, no fija snapshot ni enlace, no exige que esté completo (sin descripción dice «(sin descripción)»; sin validez usa 15 días) y no lleva QR. Sesión `USER` o `QUOTE_CODE`; solo mientras se edita (`FINALIZED` ⇒ 409, se usa `/pdf`). |
| `DELETE /quotes/{id}` | **204**. Solo `DRAFT`/`PENDING`. |

`section` aplica las definiciones del contrato de BD §4.

### Etapa 1 — crear y editar cabecera

**`POST /quotes`** → **201** `Quote` en `DRAFT`, con el campo extra `"access_code": "7K4M2Q-X9D2P4HTRB"` (**solo en esta respuesta**; ver §9). Si el `id` ya existía (reintento), responde **200** sin `access_code`: la app lo guardó o genera uno nuevo con `POST /quotes/{id}/access-code`.
```json
{ "id": "uuid?", "customer_id": "uuid",
  "service_description": "Mantención calefont", "address": "Av. X 1234",
  "latitude": -33.45, "longitude": -70.66 }
```
Alternativa: en vez de `customer_id`, un objeto `"customer": { name, phone, email?, address? }` crea el cliente y el presupuesto en una sola transacción.

**`PATCH /quotes/{id}`** — campos parciales; solo los enviados cambian.
`customer_id, service_description, address, latitude, longitude, discount, include_vat, warranty {kind, text}, validity_days, observations, include_qr`. La firma ya no se elige por presupuesto: sigue el perfil (§4).
`latitude` y `longitude` van juntas o ninguna. El backend recalcula `vat` y `total` cuando cambian `discount` o `include_vat`.

**Impuesto (decisión del 2026-10-04, varios países desde `Internacionalización.md`).** `include_vat = true` agrega el impuesto al presupuesto (se llama «IVA» en la mayoría de los países; `vat_label` dice cuál). Los precios que se escriben son **netos** (sin impuesto). La tasa es `vat_rate` del presupuesto, copiada de su país al crearlo (19 % en Chile, 18 % en Perú, 16 % en México…); el impuesto es esa tasa de `subtotal − discount` (el descuento va antes del IVA), redondeado al peso con `.5` hacia arriba, y `total = subtotal − discount + vat`. Con `include_vat = false`, `vat = 0` y `total = subtotal − discount`, como antes. Es una línea informativa de un presupuesto comercial: **no** emite documentos tributarios (el pie del PDF sigue diciéndolo). La tasa vive solo en el servidor; los clientes pueden mostrar una vista previa pero siempre muestran lo que devuelve el servidor.

### Rehacer un presupuesto rechazado: versiones (decisión del 2026-10-04)

Un presupuesto terminado sigue siendo inmutable: lo que se envió al cliente no cambia. Pero uno **rechazado** puede rehacerse como una **nueva versión** (2.ª, 3.ª…), que es otro presupuesto con su propio código, número y PDF, y que dice de qué versión viene.

**`POST /quotes/{id}/revise`** (solo sesión `USER`; cuerpo opcional `{ "id": "uuid" }` para reintentos) → **201** `Quote` en `DRAFT` con `version = anterior + 1`, `previous_number` (el número del rechazado) y el campo extra `"access_code"` (como en `POST /quotes`).
- Solo si `commercial_status = REJECTED`; si no, **409 `INVALID_STATE`**. Un rechazado se rehace **una sola vez**: si ya tiene una versión nueva, **409 `ALREADY_REVISED`** con el `id` de esa versión en `details`.
- **Se copia:** cliente, descripción del trabajo, dirección y ubicación, ítems y tareas (con ids nuevos), descuento, IVA, garantía, validez, observaciones, firma y QR, y las notas y medidas de la visita.
- **No se copia:** fotos y notas de voz (siguen en la versión original), el seguimiento, el número ni las fechas.
- La versión original queda como estaba (`REJECTED`) y su detalle trae `next_version_id`. Cada versión se numera `CP-AAAA-NNNN` como cualquier presupuesto al terminarla.
- **Se ve en todas partes:** `version` y `previous_number` aparecen en el detalle, el listado (`version`), el snapshot, la vista pública y el PDF («Presupuesto CP-2026-0007 · Versión 2», y debajo «Reemplaza al presupuesto CP-2026-0003»). La versión 1 no muestra nada extra.
- Requiere conexión (necesita el presupuesto original en el servidor).

### Corregir el teléfono o el correo del cliente (decisión del 2026-10-04)

**`GET /quotes/{id}/events`** (sesión `USER` o `QUOTE_CODE` del presupuesto) → `text/event-stream`. Avisa en vivo que **algo del presupuesto cambió** (ítems, IVA, notas, fotos, datos del cliente, estado…) hecho desde cualquier cliente (app o web). Cada aviso es `event: changed` con `data: {"quote_id":"uuid"}`; no trae los datos nuevos: el cliente vuelve a pedir `GET /quotes/{id}`. Un comentario `: ping` cada 25 s mantiene viva la conexión y `retry: 3000` fija la reconexión. Ajeno o inexistente ⇒ 404. El navegador no se conecta directo a la API (no tiene el token): la web lo reenvía desde su servidor (Arquitectura §6).

**`PATCH /quotes/{id}/customer`** (sesión `USER` o `QUOTE_CODE` del presupuesto) → **200** `Quote`. Cuerpo parcial, al menos un campo: `{ "phone"?, "email"? (puede ser null), "name"? }`.
- El teléfono y el correo se pueden corregir **siempre, también con el presupuesto terminado ni enviado**: normalmente el cliente se equivoca al dárselos y los confirma después. No cambian el PDF ni el snapshot (solo llevan el nombre del cliente), y el siguiente envío por correo o WhatsApp usa los datos corregidos.
- El `name` se puede corregir **en cualquier estado** (decisión del 2026-10-05; antes solo mientras se editaba). Lo que ya se emitió no cambia: el PDF y la vista pública de un presupuesto terminado conservan el nombre con que se emitió (el snapshot es inmutable); el nuevo nombre se ve en la app, en la web de edición y en los envíos siguientes.
- Modifica al **cliente**, así que el cambio se ve en todos sus presupuestos. Solo toca al cliente de ese presupuesto (nunca a otro). `phone` va en formato internacional como en `POST /customers`; un dato inválido da **422**.
- Queda en la auditoría (`CUSTOMER_CONTACT_UPDATED`).

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
  { "id": "uuid?", "description": "Pilas grandes", "quantity": 1, "unit": "un", "unit_price": 5000 },
  { "description": "Piso flotante", "quantity": 12.5, "unit": "m2", "unit_price": 18000 } ] }
```
`unit` es el código del catálogo de §12.1 y vale `un` si se omite.

**Ítems y tareas (decisión del 2026-10-04).** Cada línea tiene `kind`: `ITEM` (por defecto) o `TASK`. Una **tarea** es una actividad que se cobra o se incluye sin medirla, por ejemplo «botar escombros» o «limpiar bodega»: no tiene cantidad ni unidad.
```json
{ "kind": "TASK", "id": "uuid?", "description": "Botar escombros", "unit_price": 30000 }
```
- En una tarea **no se envían** `quantity` ni `unit` (422 si vienen): el servidor guarda `quantity = 1` y `unit = 'un'`, y `line_total = unit_price`.
- `unit_price` es opcional en una tarea y vale `0` si se omite: una tarea en `0` se presenta como **«Incluido»** (va en el presupuesto pero no suma al total).
- Las tareas cuentan en `subtotal` como cualquier línea, se muestran con la etiqueta «Tarea» y sin cantidad, unidad ni precio unitario, y se mantienen en el orden en que se ingresaron. Un presupuesto puede tener solo tareas. Responde `Quote` con `line_total`, `subtotal`, `vat` y `total` calculados. `line_total = round(quantity × unit_price)`, redondeo hacia arriba en `.5`.

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
- Al menos 1 línea (ítem o tarea); cada ítem con `quantity > 0` y `unit_price ≥ 0`.
- `discount ≤ subtotal`.
- `validity_days` definido.
- `warranty.kind = CUSTOM` ⇒ `warranty.text` presente.

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

## 9. Acceso por código del presupuesto

Es la forma de recuperar un presupuesto **sin una sesión `USER`** (Definición §35, "ID + código seguro"). El código tiene la forma `7K4M2Q-X9D2P4HTRB`: un ID corto de 6 caracteres y un secreto de 10 (alfabeto Crockford base32: sin `I`, `L`, `O`, `U`). El servidor lo genera al crear el presupuesto; la app móvil lo muestra y lo guarda en el almacenamiento seguro del teléfono.

| Método y ruta | Quién | Descripción |
|---------------|-------|-------------|
| `POST /quotes/{id}/access-code` | `USER` | Crea o **rota** el código (revoca el anterior). Responde una sola vez `{ "code": "7K4M2Q-X9D2P4HTRB" }`. En cualquier estado del presupuesto. |
| `DELETE /quotes/{id}/access-code` | `USER` | **204**, revoca el código. |
| `POST /access/code/exchange` | anónimo | `{ "code": "7K4M2Q-X9D2P4HTRB" }` → `{ "token": "<sesión QUOTE_CODE>", "quote_id": "uuid", "doc_status": "PENDING", "expires_at": "…" }` (30 min). |

**Normalización:** el servidor ignora espacios y guiones, pasa a mayúsculas y lee `I`/`L` como `1` y `O` como `0` (así se tolera un error al teclear). **Errores:** código inexistente, con secreto equivocado o revocado ⇒ el mismo **404 `NOT_FOUND`** ("No existe un presupuesto con ese código"), sin distinguir; 429 si se superan los límites de §1. La respuesta tarda lo mismo exista o no el ID (Contrato BD §6).

### Qué puede hacer una sesión `QUOTE_CODE` (solo sobre su presupuesto)

| Estado del presupuesto | Permitido |
|------------------------|-----------|
| `DRAFT` / `PENDING` | `GET /quotes/{id}`; `GET preview`; `PATCH`; `PUT survey|measurements|items`; subir y borrar fotos y notas de voz; `GET /files/*` de ese presupuesto; `GET logo`; `POST save`; `POST finalize`. |
| `FINALIZED` | `GET /quotes/{id}` (solo lectura); `GET pdf`, `share`, `qr.png`, `logo`; `POST send-email`; `POST mark-sent`. |

Todo lo demás responde **403 `INSUFFICIENT_SCOPE`**: borrar el presupuesto, estado comercial y seguimiento, gestionar el código, clientes, perfil, dashboard y cualquier otro presupuesto.

### Cómo lo usa la web

La caja "Consultar presupuesto" llama a `/access/code/exchange`, guarda el token en una cookie `httpOnly` y la pantalla decide con `doc_status`: pendiente ⇒ completar o editar (`Guardar` o `Terminar y enviar`); finalizado ⇒ solo ver, descargar el PDF y reenviar por correo o WhatsApp.

### Abrir el presupuesto en la web escaneando un QR (decisión del 2026-10-04)

Alternativa a escribir el código: la portada muestra un QR **por visita** y la app, ya logueada, lo escanea para abrir **ese presupuesto en el computador**. Detalle de pantallas y seguridad en `Mecanismo de consulta web mediante QR fijo.md` (v1.3).

| Método y ruta | Quién | Descripción |
|---------------|-------|-------------|
| `POST /access/pair` | anónimo (la web) | Crea un vínculo de **2 minutos**. Responde `{ "id": "uuid", "code": "<para el QR>", "secret": "<para esperar>", "expires_at": "…" }`. `code` y `secret` son aleatorios de 128 bits y se guardan solo como hash. |
| `POST /access/pair/poll` | anónimo (la web) | `{ "id", "secret" }` → `{ "status": "WAITING" }` mientras nadie lo escanee; al escanearse, **una sola vez**, `{ "status": "CLAIMED", "token": "<sesión QUOTE_CODE>", "quote_id": "uuid", "doc_status": "PENDING", "expires_at": "…" }` (30 min, igual que `/access/code/exchange`). Vencido, ya entregado, inexistente o con secreto equivocado ⇒ el mismo **404 `NOT_FOUND`**. |
| `POST /access/pair/claim` | `USER` | `{ "code": "<del QR>", "quote_id": "uuid" }` → **204**. Exige que el presupuesto sea del usuario (si no, 404, como en el resto de la API) y crea la sesión `QUOTE_CODE` que recogerá la web. Código inexistente, vencido o ya usado ⇒ **404**. |

El `secret` nunca viaja en el QR: quien fotografíe el QR no puede recibir la sesión. La web hace `poll` desde el servidor de Next (la sesión nunca llega al JavaScript de la página) y la guarda en la misma cookie `httpOnly` del canje por código. Auditoría: `ACCESS_PAIR_USED` (usuario y presupuesto).

### Advertencia de seguridad (decisión abierta, §15 n.º 6)

Quien tiene el código tiene los permisos del profesional sobre ese presupuesto, incluido **finalizar y enviar**. Al cliente se le entrega el enlace público o el QR (§10), no el código. La landing invita a los clientes a escribir un código para ver su presupuesto: con un presupuesto `FINALIZED` eso solo les permite ver, descargar y reenviar (sujeto al límite de `send-email`), pero con uno `PENDING` permitiría editar. Por eso el código de un presupuesto sin finalizar no debe compartirse con el cliente.

---

## 10. Acceso público del cliente (solo lectura)

Sin autenticación; el token de la URL es la credencial. Nunca expone `user_id`, IDs internos, levantamiento, fotos, notas, seguimiento ni datos de acceso.

### `GET /public/quotes/{token}`
**200** — el snapshot del contrato de BD §5, **sin** teléfono ni correo del cliente:
```json
{ "number": "CP-2026-0001", "version": 1, "previous_number": null, "finalized_at": "…", "issued_on": "2026-10-03", "valid_until": "2026-10-18",
  "timezone": "America/Santiago", "country": "CL", "currency": "CLP", "vat_label": "IVA",
  "professional": { "name": "Pedro Soto", "phone": "+56912345678", "email": "pedro@mail.cl",
                    "has_logo": true, "has_signature": false },
  "customer": { "name": "Juan Pérez" },
  "service_description": "", "service_address": null,
  "items": [], "subtotal": 0, "discount": 0, "include_vat": false, "vat": 0, "vat_rate": 19, "total": 0,
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
Opcional; la preferencia de mostrarlos la guarda el cliente. El mes y «hoy» son los de la zona horaria del usuario (`users.timezone`), no los de Santiago.
```json
{ "month": "2026-10", "quotes_count": 12, "quoted_amount": 2850000,
  "accepted_count": 7, "accepted_amount": 1920000,
  "avg_ticket": 274285, "acceptance_rate": 0.78, "follow_up_pending": 3,
  "waiting_count": 5, "waiting_amount": 1460000, "todo_count": 5 }
```

| Indicador | Definición |
|-----------|-----------|
| `quotes_count`, `quoted_amount` | Presupuestos con `finalized_at` en el mes |
| `accepted_count`, `accepted_amount`, `avg_ticket` | Presupuestos con `accepted_at` en el mes; ticket = monto / cantidad |
| `acceptance_rate` | `aceptados / (aceptados + rechazados)` decididos en el mes; `null` si no hubo ninguno. La fecha de un rechazo es la de su último cambio de estado a `REJECTED` (no existe `rejected_at`) |
| `follow_up_pending` | Tamaño de la sección Seguimiento hoy |
| `waiting_count`, `waiting_amount` | **Esperando respuesta**, hoy y sin importar el mes: presupuestos terminados con estado comercial `SENT` o `FOLLOW_UP`, y la suma de sus totales. Es el dinero que está en juego |
| `todo_count` | **Por terminar o enviar**, hoy y sin importar el mes: borradores y pendientes (`DRAFT`, `PENDING`) más los terminados que aún no se envían (`NONE`). Coincide con la pestaña «Pendientes» de la app |

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
| `item.unit` | código del catálogo de §12.1 (defecto `un`) |
| `item.unit_price` | entero 0–999.999.999 |
| `discount` | entero ≥ 0 |
| `validity_days` | entero 1–365 |
| `latitude` / `longitude` | −90…90 / −180…180, ambas o ninguna |
| `next_contact_date` | fecha ≥ hoy (`America/Santiago`) |
| `follow_up.note` | ≤ 2000 |

Cualquier campo desconocido en el cuerpo se **rechaza** con 422; nunca se copia al modelo.

---

### 12.1 Catálogo de unidades de medida

El código es lo que se guarda y se envía; el símbolo es lo que se muestra en pantalla y en el PDF. El catálogo vive en la API (la BD solo exige un código de 1–16 letras o dígitos), así que agregar una unidad no requiere migración.

| Grupo | Códigos |
|-------|---------|
| Conteo y piezas | `un`, `par`, `juego`, `kit`, `doc` (docena), `pza` (pieza), `pto` (punto), `tramo` |
| Envases y formatos | `caja`, `bolsa`, `saco`, `rollo`, `bobina`, `plancha`, `paquete`, `tubo`, `barra`, `tarro`, `balde`, `tineta` |
| Longitud | `mm`, `cm`, `m`, `ml` (metro lineal), `km`, `plg` (pulgada), `pie` |
| Superficie y volumen | `m2` (m²), `m3` (m³), `l` (litro), `gal` (galón) |
| Peso | `g`, `kg`, `ton`, `lb` |
| Tiempo y servicios | `hr`, `hh` (hora hombre), `jornada`, `dia`, `semana`, `mes`, `visita`, `servicio`, `gl` (global) |

---

## 13. Matriz de permisos

| Operación | `USER` | `QUOTE_CODE` | Público |
|-----------|:------:|:------------:|:-------:|
| Perfil, clientes, dashboard | ✔ | ✘ | ✘ |
| Crear presupuesto | ✔ | ✘ | ✘ |
| Leer / editar presupuesto editable | ✔ (propio) | ✔ (el suyo) | ✘ |
| Subir / borrar fotos y voz | ✔ | ✔ | ✘ |
| Corregir teléfono o correo del cliente (`PATCH /quotes/{id}/customer`) | ✔ (propio) | ✔ (el suyo) | ✘ |
| Guardar | ✔ | ✔ | ✘ |
| Finalizar y enviar (`send-email`, `mark-sent`) | ✔ | ✔ (el suyo) | ✘ |
| Estado comercial y seguimiento | ✔ | ✘ | ✘ |
| Borrar presupuesto | ✔ (`DRAFT`/`PENDING`) | ✘ | ✘ |
| Crear, rotar o revocar el código | ✔ | ✘ | ✘ |
| Ver snapshot y PDF | ✔ | ✔ (el suyo, finalizado) | ✔ (por token) |

---

## 14. Pruebas mínimas que cubre este contrato (`CLAUDE.md` §24)

- **Aislamiento:** usuario B recibe 404 en cada ruta con IDs del usuario A.
- **Estados:** `finalize` rechaza presupuestos incompletos; un `FINALIZED` rechaza todas las escrituras; `NONE → SENT` solo vía envío confirmado; `finalize` sin envío deja `FINALIZED + NONE`.
- **Versiones:** rehacer solo un rechazado, una sola vez, copiar lo que corresponde, que `version` suba de 1 en 1 y que el original no cambie.
- **Totales:** `line_total`, `subtotal`, `vat` y `total` con cantidades decimales, descuento e IVA (incluido el redondeo de `.5` y que el IVA se calcula después del descuento).
- **Acceso público:** el token no permite editar; revocado ⇒ 404; la respuesta no contiene campos internos.
- **Código:** `/access/code/exchange` responde el mismo 404 para ID inexistente, secreto equivocado y código revocado; 5 fallos bloquean el código; rotar invalida el anterior; el scope `QUOTE_CODE` se limita a su presupuesto y a la tabla de §9 según el estado (un `FINALIZED` rechaza toda escritura; borrar, estado comercial y clientes ⇒ 403).
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
| 6 | Alcance del código (**abierta**) | Hoy el código permite finalizar y enviar, porque el flujo del usuario es completar y cerrar desde la web. Alternativa más estricta: que el código solo permita editar y la acción de cerrar exija sesión `USER`. Se decide antes de implementar `finalize` para sesiones `QUOTE_CODE`. |
