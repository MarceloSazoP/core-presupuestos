# CorePresupuesto Backend

API REST para CorePresupuesto.

## Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copiar `.env.example` a `.env` y ajustar:

```bash
cp .env.example .env
```

Editar `.env` con la configuración local de PostgreSQL.

### 3. Crear base de datos

```bash
# En psql
psql -U postgres
CREATE DATABASE core_prespuestos;
\c core_prespuestos
\i schema.sql
```

O importar schema:

```bash
psql -U postgres -d core_prespuestos -f schema.sql
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Servidor escuchando en `http://localhost:3001`

- 🏥 Health: `http://localhost:3001/health`
- 🗄️ DB Health: `http://localhost:3001/health/db`
- 📡 API: `http://localhost:3001/api/v1`

## Scripts

- `npm run dev` — Ejecutar en desarrollo con hot-reload
- `npm run build` — Compilar TypeScript
- `npm run start` — Ejecutar build de producción
- `npm run watch` — Watch mode
- `npm test` — Ejecutar tests

## Estructura

```
src/
├── config/         # Configuración (DB, etc)
├── middleware/     # Middlewares (auth, etc)
├── routes/         # Rutas de la API
├── controllers/    # Lógica de negocio
├── types/          # Tipos TypeScript
└── index.ts        # Entrada principal

schema.sql          # Schema PostgreSQL
```

## API

Ver [../docs/Contrato de API.md](<../docs/Contrato de API.md>)

## Notas

- TypeScript obligatorio para type safety
- PostgreSQL como base de datos
- Express como framework web
- JWT para autenticación (pendiente)
