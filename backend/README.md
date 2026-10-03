# Backend

API REST de CorePresupuesto. El contrato está en [Contrato de API](<../docs/Contrato de API.md>) y el esquema en [Contrato de Base de Datos](<../docs/Contrato de Base de Datos.md>); el diseño técnico, en [Arquitectura técnica](<../docs/Arquitectura técnica.md>).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor con recarga (`tsx watch`) |
| `npm run check` | Tipos (`tsc --noEmit`) |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta |
| `npm run db:setup` | Crea las bases de `.env` si no existen y migra |
| `npm run db:migrate` | Aplica migraciones pendientes en `DATABASE_URL` |
| `npm test` | Pruebas contra `TEST_DATABASE_URL` (se niegan a correr en una base que no termine en `-test`) |

## Migraciones

Archivos `migrations/NNNN_nombre.sql`, aplicados en orden y registrados en `schema_migrations`. **Una migración ya aplicada no se edita**: los cambios van en una nueva.

## Variables de entorno

Ver `.env.example`. `.env` no se versiona. Las variables de cada proveedor (SMS, correo, almacenamiento) se agregan junto con la fase que las usa.
