# CorePresupuesto

Captura en terreno, presupuesto comercial, envío y seguimiento básico para profesionales independientes.

> **No olvides nada de lo que viste en terreno.**

## Documentación (leer en este orden)

1. [Definición Funcional del Producto — v1.0](<docs/Definición Funcional del Producto — v1.0.md>)
2. [Alcance Exacto del MVP](<docs/Alcance Exacto del MVP.md>)
3. [Reemplazo de las secciones 11 a 17 (Wizard)](<docs/Reemplazo de las secciones 11 a 17 Wizard de Nuevo Presupuesto.md>)
4. [Contrato de Base de Datos](<docs/Contrato de Base de Datos.md>)
5. [Contrato de API](<docs/Contrato de API.md>)
6. [Arquitectura técnica](<docs/Arquitectura técnica.md>)

Las reglas del proyecto están en [CLAUDE.md](CLAUDE.md).

## Estructura

```text
backend/    API Node + Express + PostgreSQL
frontend/   Web: Next.js (App Router)
mobile/     App: React Native + Expo
docs/       Documentación y contratos
```

## Puesta en marcha (backend)

Requiere Node 24 (`nvm use 24`) y PostgreSQL local.

```bash
cd backend
cp .env.example .env     # completar usuario y contraseña de PostgreSQL
npm install
npm run db:setup         # crea core-prespuestos y core-prespuestos-test y aplica las migraciones
npm test
npm run dev              # http://localhost:3001/health
```

Web y mobile se configuran en su fase (ver Arquitectura técnica §12).

## Estado

Fase 0 (entorno) completa. Sigue la Fase 1: autenticación, perfil y clientes.
