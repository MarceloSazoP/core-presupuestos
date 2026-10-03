import type { Server } from 'node:http';

// Node cierra las conexiones inactivas a los 5 s. Un móvil reutiliza su conexión después de más tiempo (p. ej. mientras
// la persona saca una foto) y su primer POST por esa conexión ya cerrada falla con "sin conexión" (ECONNRESET), sin
// reintento posible porque un POST no es idempotente. Se mantiene abierta más tiempo que cualquier proxy típico (60 s).
export function afinarServidor<T extends Server>(server: T): T {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000; // debe ser mayor que keepAliveTimeout
  return server;
}
