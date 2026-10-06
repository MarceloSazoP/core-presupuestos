import { createApp } from './app';

// Entrada para Vercel: la plataforma importa la app de Express como función; no hay `listen` (eso es server.ts, para desarrollo y servidor propio).
export default createApp();
