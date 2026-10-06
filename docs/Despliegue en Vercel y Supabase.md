# Despliegue en Vercel y Supabase

Estado: **decisión del 2026-10-06** (el VPS queda para más adelante). Todo corre en Vercel y la base de datos en Supabase:

```text
Teléfono (app) ─┐
                ├─►  Vercel · API (backend/)  ──►  Supabase · PostgreSQL
Navegador ─► Vercel · Web (frontend/) ─┘            Supabase · Storage (archivos)
```

Son **dos proyectos de Vercel** del mismo repositorio: `frontend/` (la web) y `backend/` (la API). La web le habla a la API (`API_BASE_URL`); la app móvil también (`EXPO_PUBLIC_API_URL`).

## 1. Qué cambia respecto del servidor tradicional

Vercel ejecuta el backend como **funciones sin estado**: cada petición puede caer en una instancia distinta, el disco no es permanente y no hay procesos de larga duración. Por eso:

| Tema | Antes (servidor) | En Vercel + Supabase |
|------|------------------|----------------------|
| Archivos (fotos, audios, PDF, logo, firma) | Disco (`STORAGE_DIR`) | **Supabase Storage** (bucket privado), por `STORAGE_DRIVER=supabase`. El disco local sigue para desarrollo y pruebas. El tmp de las subidas va a `/tmp`. Los rangos (`Range`) del audio se atienden desde memoria. |
| Conexiones a la base | Un `Pool` de 10 | `Pool` chico (`DATABASE_POOL_MAX`, 3) y la cadena del **pooler** de Supabase. SSL activo. |
| Avisos de cambio en vivo (`GET /quotes/{id}/events`, SSE + `LISTEN`) | Una conexión `LISTEN` por proceso | **Apagados** (`LIVE_EVENTS=false`): el endpoint responde 204 y el cliente deja de reconectar. La app y la web siguen funcionando; se actualizan al volver a la pantalla y por sondeo. |
| Límites de ingreso (por IP y por teléfono) | En memoria | Siguen por teléfono y usuario contra la base (`audit_events`, `auth_challenges`). El límite **por IP** es en memoria **por instancia**: frena menos. Se endurece con un almacén en la base si hace falta. |
| Tamaño de petición | Sin tope práctico | Una función de Vercel admite **4,5 MB** por petición: las fotos ya se reducen en la app y las notas de voz caben; el tope de subida del contrato (§8) no puede superarlo. |
| Tiempo máximo | Sin tope | `maxDuration` configurado en `vercel.json`. Generar el PDF y enviar el correo caben holgados. |

## 2. Supabase

1. Crear el proyecto en la región más cercana (São Paulo).
2. **Base de datos:** copiar la cadena de conexión del *pooler* (modo *transaction*, puerto 6543) para `DATABASE_URL` agregándole `?sslmode=no-verify` (Supabase exige SSL); para las **migraciones** usar la de *sesión* (puerto 5432): `npm run db:migrate` con esa URL.
3. **Seguridad:** las tablas quedan en `public`, que Supabase expone por su API de datos. La migración `0016` activa RLS en todas (sin políticas): nada es accesible con la clave pública. El backend se conecta como dueño de las tablas, que no pasa por RLS. Además conviene **desactivar la Data API** del proyecto.
4. **Storage:** crear un bucket **privado** (por ejemplo `archivos`). El backend lo usa con la clave `service_role`, que **nunca** va a la app ni a la web.

## 3. Variables de entorno

**API (`backend/`):** `DATABASE_URL`, `DATABASE_POOL_MAX=3`, `AUTH_CODE_PEPPER`, `WEB_BASE_URL` (la URL pública de la web), `CORS_ORIGINS` (la de la web), `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`, `LIVE_EVENTS=false`, `TRUST_PROXY=1`, el correo (Resend o SMTP) y, si se usan, `GOOGLE_PLACES_API_KEY` y `TWILIO_*`.

**Web (`frontend/`):** `API_BASE_URL` (la URL pública de la API con `/api/v1`).

**App:** `EXPO_PUBLIC_API_URL` apuntando a la misma API.

## 4. Pasos

1. Crear el proyecto de Supabase, el bucket y aplicar las migraciones (hasta la 0016).
2. Proyecto de Vercel de la API: *Root Directory* `backend`, Node 24, variables de §3, región São Paulo (`gru1`).
3. Proyecto de Vercel de la web: *Root Directory* `frontend`, `API_BASE_URL`.
4. Dominios: uno para la web y otro para la API (HTTPS).
5. Probar el ciclo completo: ingresar, crear, terminar, enviar y abrir el enlace del cliente; subir una foto y un audio.

## 5. Techos conocidos

- Una subida mayor de 4,5 MB no cabe en una función: si hiciera falta, las subidas pasarían a ir directo a Storage con una URL firmada.
- Los avisos en vivo pueden volver con un servicio aparte (Supabase Realtime) si se echan de menos.
- El barrido de archivos huérfanos (`npm run sweep-files`) solo recorre el disco: con Storage se haría desde un cron de Vercel.
