# CorePresupuesto — Arquitectura Técnica

**Versión:** 0.2 (borrador para revisión; incorpora las reglas de las skills de mobile y web)
**Fecha:** 2026-10-03
**Depende de:** `CLAUDE.md`, `Contrato de Base de Datos.md` v0.2, `Contrato de API.md` v0.2.
**Alcance:** cómo se construye lo que los contratos ya definen. No cambia ni agrega comportamiento de producto.

Criterio rector: **lo mínimo que cumple los contratos**. Una librería o capa entra solo si la plataforma o lo ya instalado no resuelve el problema, o si hacerlo a mano es un riesgo de seguridad.

---

## 1. Vista general

```text
        Mobile (Expo / React Native)                Web (Next.js 16, App Router)
        ┌──────────────────────────┐               ┌──────────────────────────────┐
        │ SQLite local + outbox    │               │ Servidor Next = BFF          │
        │ cámara · voz · GPS       │               │ cookie httpOnly con el token │
        │ SecureStore (token)      │               │ páginas públicas /q y /e     │
        └────────────┬─────────────┘               └──────────────┬───────────────┘
                     │ HTTPS · Authorization: Bearer              │ HTTPS · Bearer
                     └────────────────────┬───────────────────────┘
                                          ▼
                        API REST /api/v1 — Node 24 + Express 5 + TypeScript
                        ┌─────────────────────────────────────────────────┐
                        │ zod en el borde · reglas de negocio · PDF y QR  │
                        └───────┬──────────────────┬──────────────┬───────┘
                                ▼                  ▼              ▼
                          PostgreSQL        Disco (STORAGE_DIR)   Twilio (SMS) · Resend (correo)
```

- **Un solo backend** con todas las reglas. Web y Mobile solo presentan y reenvían (CLAUDE.md §6).
- La API acepta **únicamente `Authorization: Bearer`**, nunca cookies. Eso elimina CSRF contra la API.
- La web guarda el token de sesión en una cookie `httpOnly` que solo lee su servidor (§6); el navegador nunca lo ve.

---

## 2. Decisiones

Versiones consultadas el 2026-10-03.

| # | Tema | Decisión | Alternativas descartadas y motivo |
|---|------|----------|-----------------------------------|
| A1 | Runtime backend | **Node 24 LTS** | Node 20, el instalado en esta máquina (v20.20.0), figura fuera de soporte en nodejs.org. Node 22 está en mantenimiento. |
| A2 | Framework HTTP | **Express 5** (ya instalado) | Fastify: sin ventaja que justifique migrar. Express 5 propaga errores de handlers `async` sin envoltorios. |
| A3 | Validación | **zod 4**, esquemas `.strict()` en cada ruta | A mano: son ~40 campos con reglas del contrato §12 y el contrato exige rechazar campos desconocidos. |
| A4 | Acceso a datos | **`pg` con SQL parametrizado**, sin ORM | Un ORM duplica el esquema ya definido en SQL. Nombres de columna jamás se construyen desde la entrada del usuario. |
| A5 | Migraciones | **Archivos `.sql` numerados + runner de ~30 líneas** con tabla `schema_migrations` | `node-pg-migrate`: dependencia para algo que el contrato ya es (DDL). |
| A6 | Tokens y códigos | **`node:crypto`**: `randomBytes` (tokens), `randomInt` (código de 6 dígitos), SHA-256 (tokens), HMAC-SHA256 con pepper del servidor (código) | Librerías de hash: no hacen falta; los tokens son de 192–256 bits. |
| A7 | PDF | **pdfmake 0.3.11** | pdfkit: tablas con salto de página a mano. Puppeteer: arrastra un Chromium completo. |
| A8 | QR | **qrcode 1.5.4** (`toDataURL` y `toBuffer`) | Última publicación nov-2025; estable y sin dependencias nativas. |
| A9 | Subida de archivos | **multer 2.4** a disco temporal + verificación de *magic bytes* propia | Confiar en `Content-Type` del cliente. |
| A10 | Límite de tasa | **express-rate-limit 8.7** con almacén en memoria | Redis: infraestructura extra. Techo: una sola instancia de API (ver §10). |
| A11 | Logs | **pino 10** con redacción de `authorization`, códigos y tokens | `console.log`: filtra secretos con facilidad. |
| A12 | Correo | **Resend por HTTPS con `fetch`**, sin SDK | SES: más barato a escala pero con más configuración. Nodemailer: dependencia. Cambiar de proveedor es reescribir una función. |
| A13 | SMS | **Twilio Programmable Messaging por HTTPS con `fetch`**, sin SDK | Twilio Verify: cobra US$0,05 extra por verificación y el contrato ya genera y valida el código. |
| A14 | Almacenamiento | **Disco local** tras `put/openRead/remove(storage_key)` | Almacenamiento de objetos: se evalúa cuando haya más de un servidor o el volumen lo pida. El esquema no cambia. |
| A15 | Pruebas backend | **`node:test` + `tsx`**, contra PostgreSQL real (`core-prespuestos-test`), llamando con `fetch` a la app en puerto efímero | Vitest y supertest: dependencias sin necesidad. Mocks de BD: ocultan errores de SQL y de aislamiento. |
| A16 | Tipos compartidos | **Sin paquete `shared/`**. Cada cliente declara los tipos del contrato de API §2 en `src/api/types.ts` | Un paquete compartido exige configurar workspaces con Next y Metro; son ~60 líneas de tipos y no son lógica de negocio. |
| A17 | Web | **Next.js 16 como BFF** (§6) | Llamar a la API desde el navegador con el token en `localStorage`: expuesto a XSS. |
| A18 | Mobile estilos | **`StyleSheet` de React Native** + `constants/theme.ts` de la plantilla | NativeWind: dependencia nueva sin necesidad. |
| A19 | Mobile listas | **`@shopify/flash-list`** para toda lista (clientes, presupuestos, miniaturas de fotos), incluso las cortas | `ScrollView` con `map` y `FlatList`: la skill `vercel-react-native-skills` manda virtualizar siempre. Está en la documentación del SDK 57 y funciona en Expo Go. |
| A20 | Mobile imágenes | **`expo-image`** (ya instalado) para todas las imágenes, incluidas las miniaturas locales | `Image` de React Native: sin caché ni reciclado en listas. |
| A21 | Mobile navegación | **Pila nativa de Expo Router** (estable) y pestañas con **`Tabs`** (JS, estable). Pasar a `NativeTabs` cuando sea estable | `NativeTabs` hoy es inestable (`expo-router/unstable-native-tabs`; estable en el SDK 58) y tiene límites: máximo 5 pestañas en Android y comportamiento irregular con listas. Las skills lo prefieren, pero según la documentación del SDK manda la estabilidad. La migración es cambiar un archivo de layout. |
| A22 | Mobile háptica | **`expo-haptics`**: un háptico por acción confirmada, siempre acompañado de un cambio visual | Háptico por fotograma o como único aviso. En Android se usa `performAndroidHapticsAsync`: la documentación desaconseja el `Vibrator` que usan los otros métodos. |

### Verificación hecha (no son suposiciones)

| Qué | Resultado |
|-----|-----------|
| pdfmake 0.3.11 + qrcode, en un script aparte | PDF de 2 páginas con 45 ítems, **encabezado de tabla repetido** en la 2.ª, tildes, `ñ`, `—` y `º` correctos, QR incrustado, 30 KB, ~0,5 s la primera vez. Estructura válida según `qpdf`. |
| Política de acceso de pdfmake | Por defecto puede leer archivos locales y descargar URLs. Hay que **denegar todo salvo el directorio de fuentes** (el script falló al denegar todo, porque también bloquea las fuentes). |
| Módulos Expo SDK 57 | Confirmados en `docs.expo.dev/versions/v57.0.0`: `expo-audio` (no `expo-av`, obsoleto), `expo-camera`, `expo-sqlite`, `expo-file-system` (API de objetos `File`/`Directory`), `expo-notifications`, `expo-secure-store`, `expo-sharing`, `expo-image-manipulator`, `expo-image-picker`, `expo-network`. |
| Next.js 16 (docs en `node_modules`) | `middleware` pasó a llamarse **`proxy`**; `cookies()` es asíncrono; recomienda una capa de acceso a datos con `server-only`. |
| Twilio a Chile | US$0,0797 por SMS. Remitente alfanumérico solo dinámico (Twilio lo reemplaza por un número aleatorio); los números locales no admiten marketing, y un código de verificación no lo es. |
| PostgreSQL local | 14 en ejecución (`postgresql-x64-14`). `psql` no está en el `PATH`. |

### Por verificar al implementar

- Que `createUploadTask` de `expo-file-system` permita cabeceras (el `Bearer`); si no, subir con `fetch` y `FormData`.
- Adjuntos y formato exacto de la API de Resend.
- Que `https://wa.me/<número>?text=…` abra WhatsApp con el mensaje en iOS y Android.
- Límite de cuerpo de las subidas desde la web a través de Next (`proxyClientMaxBodySize` y el tope de Server Actions).
- Que `contentInsetAdjustmentBehavior`, `boxShadow` y `borderCurve` se comporten igual en Android; son reglas de la skill pensadas sobre todo para iOS.
- Que Tailwind 4 realmente condicione `hover:` a `(hover: hover)`, como afirma la skill `mobile-native`. Se comprueba en el primer componente con estado `hover`.
- PostgreSQL 14 sale de soporte en noviembre de 2026 (calendario de postgresql.org); producción debería partir en una versión vigente. El contrato solo exige PostgreSQL ≥ 13 por `gen_random_uuid()`.

---

## 3. Backend

### Estructura

```text
backend/
├── migrations/            0001_init.sql … (DDL del contrato de BD, en orden)
├── scripts/               migrate.ts · sweep-files.ts (archivos huérfanos)
├── src/
│   ├── server.ts          arranque (listen, cierre ordenado)
│   ├── app.ts             createApp(): arma Express; lo usan servidor y pruebas
│   ├── config.ts          variables de entorno validadas con zod; falla al arrancar
│   ├── db.ts              Pool, query(), withTx()
│   ├── errors.ts          AppError(code, status) → formato de error del contrato §1
│   ├── http/              sesión, guardas de scope, rate limits, validate(), manejador de errores
│   ├── modules/
│   │   ├── auth/  me/  customers/
│   │   ├── quotes/        cabecera, survey, medidas, ítems, save, finalize, send, comercial
│   │   ├── followups/  dashboard/  files/  access/  public/
│   │   └── (cada módulo: routes.ts · schemas.ts · queries.ts)
│   └── lib/               crypto · storage · pdf · qr · mail · sms · time
└── test/                  una suite por área del contrato §14
```

Sin clase base genérica de CRUD ni capa `services` que solo reenvíe: la ruta valida, llama a las consultas del módulo y responde.

### Reglas de implementación

1. **Un único punto de entrada por presupuesto:** `loadQuote(session, id)` filtra por `user_id` y, si la sesión es `QUOTE_EDIT`, exige `id = session.quote_id`. Toda ruta de `/quotes/{id}/…` empieza por ahí. Devuelve 404 si no existe o es ajeno (Contrato BD §6).
2. **Toda función de consulta recibe `userId`.** Nunca se consulta por `id` solo.
3. **Escrituras multi-tabla en `withTx`.** Obligatorio en `finalize`, creación de presupuesto con cliente en línea y reemplazo de ítems o medidas.
4. **Totales** los calcula una función única en `modules/quotes`; los clientes nunca los envían (Contrato API §6).
5. **Numeración atómica:** `INSERT INTO quote_counters … ON CONFLICT (user_id, year) DO UPDATE SET last_number = quote_counters.last_number + 1 RETURNING last_number`, con el año en `America/Santiago`.
6. **"Hoy"** se calcula en SQL: `(now() AT TIME ZONE 'America/Santiago')::date`.
7. **Respuestas con serializadores explícitos**, nunca `SELECT *` hacia el cliente. El snapshot público se arma desde `quote_documents.snapshot`, no desde las tablas vivas.
8. **Cabeceras:** `X-Content-Type-Options: nosniff` en todo; `Cache-Control: no-store` en la API y en lo público; `X-Robots-Tag: noindex` en `/public/*`. CORS con lista de orígenes permitidos (solo el web); Mobile no usa CORS.
9. **Límites:** `express.json({ limit: '100kb' })`; `trust proxy` configurado según el hosting para que el límite por IP use la IP real.

### Autenticación (contrato API §3)

- Código de 6 dígitos con `crypto.randomInt`; se guarda **HMAC-SHA256 con un pepper del servidor** (`AUTH_CODE_PEPPER`), vigencia 10 min, 5 intentos.
- Límites por teléfono: se cuentan filas de `auth_challenges` de la última hora (3 máximo), sin infraestructura extra. Límite por IP: `express-rate-limit`.
- **Tope diario global de SMS** (`SMS_DAILY_CAP`): al superarlo, `auth/start` por SMS responde 429. Protege el gasto frente a abuso (cada SMS cuesta ~US$0,08).
- Token de sesión: `randomBytes(32)` en base64url, se guarda su SHA-256. Se muestra una sola vez.
- Desarrollo: con `OTP_LOG_CODES=true` y `NODE_ENV≠production` el código se escribe en el log. **Nunca** se devuelve en la respuesta de la API.
- El mensaje SMS va en español, con el código y la advertencia de no compartirlo.

### Archivos

- Ruta: `STORAGE_DIR/u/{user_id}/q/{quote_id}/{file_id}.{ext}`; `ext` sale de una lista fija según el tipo detectado, nunca del nombre que envía el cliente.
- Flujo de subida: multer escribe a `STORAGE_DIR/tmp` con el límite del recurso → se verifica la firma (JPEG `FF D8 FF`, PNG, M4A `ftyp` en el byte 4, MP3 `ID3` o `FF Fx`) → se mueve a la ruta final → se insertan las filas en una transacción.
- Si la transacción falla, se borra el archivo. Lo que quede huérfano lo elimina `scripts/sweep-files.ts` (archivos en disco sin fila en `files`, con más de 1 hora de antigüedad), programado a diario.
- Se sirven con `res.sendFile`, `Content-Type` tomado de la BD, solo tras autorizar.

### PDF y QR

- `lib/pdf.ts` recibe el **snapshot** y devuelve un `Buffer`. Sin acceso a la BD ni al disco, salvo el logo y la firma que se le pasan ya leídos.
- Se fijan `setUrlAccessPolicy(() => false)` y `setLocalAccessPolicy` restringido al directorio de fuentes de pdfmake; las imágenes entran como datos en memoria. Evita lectura de archivos o peticiones de red desde contenido del usuario.
- Fuente Roboto incluida en pdfmake; formato de dinero con `toLocaleString('es-CL')`.
- El QR (`qrcode`) apunta a `public_url`, la URL de la **web** (`WEB_BASE_URL/q/{token}`), no a la API.
- Fotos, notas y medidas nunca se pasan a `lib/pdf.ts`.
- `finalize` es síncrono (Contrato API §15). Orden: construir snapshot → generar PDF en memoria → escribir el archivo → transacción (número, snapshot, filas, estado, enlace público) → si falla, borrar el archivo.

### Correo y SMS

`lib/mail.ts` y `lib/sms.ts` son una función cada una, con un `fetch` a la API del proveedor.

- Credenciales por entorno. En producción la configuración incompleta **impide arrancar**.
- Tiempo de espera de 10 s y un solo reintento ante error de red. Un fallo de envío devuelve 502 sin registrar el envío (Contrato API §7).
- El correo del presupuesto lleva el PDF adjunto y el enlace público; el remitente es de un dominio propio con SPF y DKIM configurados.

### Configuración

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Conexión PostgreSQL (nunca en Git) |
| `PORT`, `NODE_ENV` | Servidor |
| `WEB_BASE_URL`, `API_BASE_URL` | Armar `public_url`, enlaces de edición y PDF |
| `CORS_ORIGINS` | Orígenes permitidos del web |
| `STORAGE_DIR` | Raíz del almacenamiento |
| `AUTH_CODE_PEPPER` | Pepper del HMAC del código |
| `SMS_DAILY_CAP` | Tope diario de SMS |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo |
| `OTP_LOG_CODES` | Solo desarrollo |

Se entrega un `.env.example` sin valores reales.

---

## 4. Base de datos

- El DDL del contrato se parte en migraciones numeradas; el runner las aplica en orden y registra cada una en `schema_migrations`.
- **Una migración aplicada no se edita**; los cambios van en una migración nueva.
- Bases: `core-prespuestos` (desarrollo) y `core-prespuestos-test` (pruebas, se vacía entre pruebas).
- Respaldos: `pg_dump` diario más copia de `STORAGE_DIR`; la restauración se prueba antes de salir a producción.

---

## 5. Mobile

### Módulos Expo (SDK 57)

| Función | Módulo | Notas |
|---------|--------|-------|
| Listas | `@shopify/flash-list` | Ver A19. |
| Imágenes | `expo-image` | Ver A20. |
| Háptica | `expo-haptics` | Ver A22. |
| Fotos | `expo-camera`, `expo-image-picker` | Cámara en vivo y galería (también para logo y firma). |
| Reducción de fotos | `expo-image-manipulator` | Siempre se reconvierte a **JPEG, lado mayor 2048 px, calidad 0,8** antes de guardar: así nunca llega HEIC al servidor y se respeta el límite de 10 MB. |
| Voz | `expo-audio` | Preset `HIGH_QUALITY` (`.m4a` en ambas plataformas). Corte a los 5 min. |
| GPS | `expo-location` | Solo en primer plano y solo al tocar "usar mi ubicación". Sin geocodificación inversa. |
| Datos locales | `expo-sqlite` (modo WAL) | Borradores, outbox y caché de clientes. |
| Archivos | `expo-file-system` | Medios en `Paths.document` (persistente, no lo limpia el sistema). |
| Sesión | `expo-secure-store` | Solo el token (cabe holgado bajo ~2 KB). |
| Conectividad | `expo-network` | Solo como señal para disparar la sincronización. |
| Recordatorios | `expo-notifications` | Notificaciones **locales** por fecha. |
| Compartir | `expo-sharing` y `Linking` | PDF y WhatsApp. |

La documentación del SDK 57 indica soporte en Expo Go para `expo-sqlite`, `expo-camera`, `expo-image-picker`, `expo-image-manipulator`, `expo-secure-store` y las notificaciones **locales**. No lo verifiqué para `expo-audio`, `expo-file-system`, `expo-location`, `expo-network` ni `expo-sharing`: si alguno exige compilación nativa, se usa `eas build --profile development`. Las notificaciones **push** remotas no se usan.

### Reglas de interfaz (de `vercel-react-native-skills` y `animate-expo`)

1. **`Pressable`**, nunca `TouchableOpacity` ni `TouchableHighlight`. Objetivo táctil mínimo de 44×44 pt (48 dp en Android); si lo visual es menor, se agrega `hitSlop`.
2. **Zonas seguras:** `contentInsetAdjustmentBehavior="automatic"` en el `ScrollView` raíz, en vez de `SafeAreaView` o relleno manual.
3. **Estilos:** `StyleSheet` con `gap` para el espacio entre elementos, `borderCurve: 'continuous'` junto a `borderRadius` y `boxShadow` en sintaxis CSS (no `elevation` ni los `shadow*` antiguos).
4. **Movimiento:** solo si pasa el filtro de `animate-expo`. Las pestañas no se deslizan, las transiciones de pantalla las pone la pila nativa y no se reescriben, y el feedback al presionar dura 100–150 ms. Todo lo que se anima usa Reanimated, nunca `setState` desde un gesto, y respeta "reducir movimiento" desde el primer día.
5. **Teclado en el asistente:** se empieza con `KeyboardAvoidingView`. `react-native-keyboard-controller` solo se agrega si no basta, y habría que comprobar antes si funciona en Expo Go o exige compilación nativa.
6. **Evaluación:** el movimiento y los gestos se juzgan en un build de release (APK `preview`), no en Expo Go ni en el simulador.

### Estructura

```text
mobile/src/
├── app/            rutas de Expo Router (solo pantallas)
├── api/            client.ts (fetch + Bearer + errores del contrato) · types.ts
├── db/             schema.ts · migraciones SQLite · consultas
├── sync/           outbox.ts (cola) · flush.ts (envío)
├── features/       auth · customers · quotes · followups
└── components/ constants/ hooks/
```

### Modelo offline (Contrato BD §9, CLAUDE.md §11)

**Alcance offline:** crear cliente, iniciar presupuesto, notas, fotos, medidas y voz. **Los ítems y precios (Etapa 3), finalizar y enviar requieren conexión**: no están en el alcance offline de la doc y finalizar necesita al servidor (numeración y PDF).

Tablas locales:

| Tabla | Contenido |
|-------|-----------|
| `quote_drafts` | `id`, `body` (JSON con el recurso `Quote` de trabajo), `dirty`, `synced_at`. Un JSON por borrador evita migrar columnas. |
| `media` | `id`, `quote_id`, `kind` (`PHOTO`/`VOICE`), `local_uri`, `caption`, `duration_seconds`, `state` |
| `customers_cache` | Clientes del usuario para seleccionarlos sin red |
| `outbox` | `seq` autoincremental, `quote_id`, `method`, `path`, `body`, `file_uri`, `state`, `attempts`, `last_error` |
| `reminders` | `quote_id` → `notification_id` |

Reglas de la cola:

1. Toda edición escribe primero en SQLite y después encola. La interfaz nunca espera a la red.
2. **Colapso:** un `PUT` o `PATCH` nuevo sobre la misma ruta y el mismo presupuesto reemplaza al pendiente (gana la última escritura, Contrato BD §9).
3. Envío en orden `seq`. El `id` generado en el cliente hace seguros los reintentos (Contrato API §1), y el orden asegura que el presupuesto exista antes de sus fotos.
4. **Fallo de red o 5xx:** se detiene y reintenta con espera creciente. **429:** respeta `Retry-After`. **401:** cierra la sesión local. **409 `INVALID_STATE`:** el presupuesto cambió en otro lado; se descarga la copia del servidor y se avisa. **Otro 4xx:** la operación pasa a `failed` y se muestra "requiere atención"; no se descarta en silencio.
5. **Disparadores:** abrir la app, volver a primer plano, cambio de conectividad y después de cada edición. No hay tarea en segundo plano en el MVP.
6. Indicador visible de operaciones pendientes en el encabezado (Wizard §13.5), sin bloquear la captura.
7. `expo-network` solo es una pista: en iOS `isInternetReachable` coincide con `isConnected`. Lo que decide es el resultado real de la petición.
8. Antes de finalizar, enviar o cambiar de estado se hace `flush()` de ese presupuesto; si no vacía la cola, se bloquea con un mensaje claro.
9. Los archivos locales se conservan hasta que el presupuesto se finaliza, para poder verlos sin red; luego se purgan.

### Envío y seguimiento

- **WhatsApp:** abrir `https://wa.me/<número>?text=<mensaje con public_url>`, con respaldo a la hoja de compartir. La app **no puede saber** si el usuario envió el mensaje: al volver pregunta "¿Lo enviaste?" y solo entonces llama a `mark-sent` (Contrato API §7).
- **PDF:** se descarga `GET /quotes/{id}/pdf` al caché y se comparte con `expo-sharing`.
- **Recordatorios:** una notificación local a las 09:00 (`America/Santiago`) del `next_contact_date`. Al abrir la app y tras cada cambio de seguimiento se reconcilian con `GET /quotes?commercial_status=SENT` y `FOLLOW_UP` (el resumen ya trae `next_contact_date`). Se cancelan al pasar a `ACCEPTED` o `REJECTED`. Hora aproximada, así que **no** se pide el permiso de alarmas exactas. Solo suenan en el dispositivo que las programó.
- Los SO limitan las notificaciones locales pendientes: se programan solo las más próximas (cantidad a definir al implementar).

### Compilaciones

- Desarrollo con Expo Go. APK para pruebas con el perfil `preview` de `eas.json` (ya definido). AAB e iOS cuando corresponda publicar (CLAUDE.md §26).
- `bundleIdentifier`/`package`, `eas.json` y `app.json` ya existen. Al implementar hay que **depurarlos**: instalar `expo-camera` y los demás con `npx expo install` (hoy `app.json` declara el plugin de cámara sin el paquete), revisar los permisos de Android que agregó el borrador anterior (los de almacenamiento externo no hacen falta con archivos privados de la app y el selector del sistema) y quitar los marcadores de posición de `eas.json`.

---

## 6. Web

### Sesión (BFF)

- El servidor de Next es el único que habla con la API desde la web. El navegador solo habla con Next.
- Al verificar el código, una Server Action llama a `auth/verify` y guarda el token en una cookie **`httpOnly`, `Secure`, `SameSite=Lax`**, con la misma vigencia que la sesión.
- `src/lib/dal.ts` (con `server-only`) expone `getSession()` y `api(path, init)`, que agrega el `Bearer`. **La autorización real se comprueba ahí**, en cada acceso a datos. `proxy.ts` solo hace una redirección optimista al login cuando falta la cookie (así lo recomienda la guía de Next 16).
- El token nunca se escribe en `localStorage`, en URLs ni en componentes de cliente.
- La cookie guarda `{ token, scope }` (el `scope` distingue una sesión `USER` de una `QUOTE_EDIT`); la interfaz oculta lo que el scope no permite, aunque la API lo seguiría rechazando.

### Páginas

| Ruta | Contenido |
|------|-----------|
| `/login` | Onboarding y verificación |
| `/` | Dashboard (Pendientes, Seguimiento, Finalizados, indicadores opcionales) |
| `/customers`, `/customers/[id]` | Clientes e historial |
| `/quotes/new`, `/quotes/[id]` | Wizard de tres etapas; cada "Siguiente" guarda en la API, así que **no hay estado de wizard en el cliente** |
| `/q/[token]` | **Vista pública** del cliente: componente de servidor que llama a `GET /public/quotes/{token}`, con `noindex` y `Cache-Control: no-store`. El PDF enlaza directo a la API. |
| `/e/[token]` | Enlace de edición: intercambia el token, fija la cookie `QUOTE_EDIT` y redirige a `/quotes/[id]` |

- Los enlaces de edición abren solo en la web. En el móvil, el profesional entra con SMS o correo.
- Estilos con Tailwind 4 (ya instalado), sin biblioteca de componentes.
- Formularios con Server Actions y `useActionState`; los errores 422 de la API se muestran por campo (`details[].field`).
- Subidas de archivos desde la web pasan por un Route Handler que reenvía el flujo a la API (límites por verificar, ver §2).

### Web en el teléfono (base de `mobile-native`)

El enlace público llega por WhatsApp y se abre en el teléfono, así que `/q/[token]`, `/e/[token]` y `/login` cumplen esta base desde el primer componente:

- **Viewport** con el export `viewport` de Next: `viewportFit: 'cover'` (existe en el código de Next 16, aunque su documentación no lo menciona) y `themeColor` por esquema de color con `media: '(prefers-color-scheme: …)'`. **Nunca** `userScalable: false` ni `maximumScale: 1`, aunque el ejemplo de la documentación de Next los muestre: desactivar el zoom es un fallo de accesibilidad.
- **Zonas seguras:** `padding` con `env(safe-area-inset-*)` en encabezados y barras inferiores.
- **Altura:** `100dvh` en el contenedor de la app y `100svh` en portadas; nunca `100vh` para algo fijado abajo.
- **Inputs:** `font-size: 16px` como mínimo para que iOS no haga zoom. El código de verificación lleva `inputMode="numeric"` y `autoComplete="one-time-code"`; el teléfono, `type="tel"`; el correo, `type="email"`.
- **Toque:** `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` en botones y enlaces, estado `:active` propio y `user-select: none` solo en controles, nunca en el `body`.
- **`:hover`** solo dentro de `@media (hover: hover) and (pointer: fine)`.
- **Desplazamiento:** `overscroll-behavior: none` en `html` y `body`, y `contain` en contenedores internos con scroll.
- **Validación:** esto no se puede comprobar en el emulador de Chrome; se prueba en un teléfono real abriendo el servidor por la IP de la red local.

### Dinero y fechas

`Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })` en web y mobile. Los clientes muestran siempre los totales que devuelve el servidor.

---

## 7. Seguridad (resumen operativo)

Las reglas de acceso están en el Contrato de BD §6. Aquí, lo que las implementa:

- **Aislamiento:** `loadQuote` y `userId` obligatorio en cada consulta (§3). La FK compuesta de la BD es la segunda barrera.
- **Sin SQL dinámico desde la entrada:** columnas fijas por consulta; valores siempre por parámetros.
- **Sin asignación masiva:** los esquemas `.strict()` rechazan campos desconocidos y la ruta construye explícitamente lo que escribe.
- **Secretos** solo por variables de entorno; `.env` fuera de Git; el arranque falla si falta alguno requerido.
- **Logs** sin tokens ni códigos (redacción en pino); la auditoría guarda eventos, no secretos.
- **HTTPS** obligatorio en producción (lo termina el proxy inverso); HSTS allí.
- **Enlaces públicos y de edición** con entropía alta, revocables, con 404 indistinto.
- **Descargas:** `nosniff` y tipo de contenido tomado de la BD, no del cliente.
- **Dependencias:** `npm audit` antes de cada despliegue y versiones fijadas con `package-lock.json`.

---

## 8. Pruebas

| Capa | Qué | Cómo |
|------|-----|------|
| Backend | Todo lo del Contrato de API §14: aislamiento entre usuarios, estados y transiciones, totales con decimales y descuento, acceso público y de edición, autenticación, idempotencia | `node:test` contra PostgreSQL real de pruebas |
| Backend | Subidas: rechazo por tamaño, por firma falsa y por tipo | Mismas suites |
| Backend | PDF: no falla con 100 ítems y tildes, devuelve `%PDF` | Una prueba, sin comparar píxeles |
| Mobile | Reglas de la cola: colapso, orden, reintentos, qué hace cada código de error | Prueba unitaria del núcleo puro de `sync/` |
| Web y Mobile | `tsc --noEmit` y lint (`expo lint`, ESLint de Next) antes de dar algo por terminado | Scripts `npm run check` |

Los clientes **no** repiten reglas de negocio en pruebas; prueban que consumen la API como dice el contrato (CLAUDE.md §24).

---

## 9. Entornos y despliegue

| Entorno | Detalle |
|---------|---------|
| Desarrollo | Node 24, PostgreSQL local, API en `:3001`, web en `:3000`, Expo Go o APK. |
| Pruebas | Base `core-prespuestos-test`; se crea y migra en la preparación de las pruebas. |
| Producción | Un servidor con proxy inverso con TLS, API Node, Next, PostgreSQL y un volumen persistente para `STORAGE_DIR`; dos subdominios (web y API); registros SPF y DKIM del dominio de correo. |

Hosting, proveedor y dominio **no están decididos** (§11). Nada del diseño depende de uno en particular.

---

## 10. Techos conocidos del diseño (qué cambiaría y cuándo)

| Decisión | Techo | Cuándo cambiarla |
|----------|-------|------------------|
| Disco local | Un solo servidor | Al necesitar más de una instancia de API |
| Rate limit en memoria | Una sola instancia | Mismo momento: pasar el almacén a la BD o Redis |
| `finalize` síncrono | Tiempo de PDF en móvil | Si supera unos segundos con presupuestos grandes |
| Sin tarea en segundo plano en mobile | La sincronización ocurre al abrir o volver la red | Si los usuarios reportan datos tardíos |
| Recordatorios solo locales | No llegan a otros dispositivos ni a la web | Si se pide aviso fuera del dispositivo (push remoto) |

---

## 11. Qué necesito de ti

1. **Hosting y dominio:** dónde se despliega y qué dominio se usa. Condiciona los enlaces públicos, el QR y el correo.
2. **Cuentas:** Twilio (SMS) y Resend (correo), con el dominio de envío verificado. Sin ellas, el desarrollo corre con `OTP_LOG_CODES=true`.
3. **Costo de SMS:** ~US$0,08 por código a Chile. ¿Aceptas ese gasto y un tope diario inicial (propongo 200 SMS)?
4. **Node 24 en esta máquina:** hoy hay Node 20. Hay que instalar Node 24 antes de la Fase 0.
5. **Luz verde para la Fase 0 (§12).**

---

## 12. Orden de implementación

Cada fase termina con sus pruebas pasando y un commit pequeño por cambio coherente (CLAUDE.md §25).

| Fase | Contenido |
|------|-----------|
| **0. Entorno** | Node 24, retirar el código provisional (`backend/src/*` actual, `schema.sql`, `shared/`, servicios y pantallas de ejemplo de web y mobile), dependencias del backend, `.env.example`, bases de desarrollo y de pruebas, runner de migraciones y `0001` desde el contrato. |
| **1. Backend base** | `config`, `db`, errores, sesión y autenticación completa, `me`, clientes. Pruebas de aislamiento desde el día uno. |
| **2. Presupuestos** | Cabecera, levantamiento, medidas, ítems, `save`, archivos (subida y descarga), borrado. |
| **3. Emisión y seguimiento** | `finalize` (snapshot, PDF, QR, enlace público), vista pública, `send-email`, `mark-sent`, estado comercial, seguimiento, enlace de edición, dashboard e indicadores. |
| **4. Web** | Login, dashboard, clientes, wizard, vista pública `/q`, enlace de edición `/e`. |
| **5. Mobile** | Login, wizard con SQLite y cola, cámara, voz, GPS, compartir y WhatsApp, seguimiento y recordatorios. |
| **6. Endurecimiento** | Límites de tasa, logs, respaldos probados, APK `preview`, revisión de seguridad. |
