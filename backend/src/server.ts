import { createApp } from './app';
import { config } from './config';
import { pool } from './db';
import { cerrarAvisos } from './lib/events';
import { afinarServidor } from './http/servidor';

const server = afinarServidor(
  createApp().listen(config.PORT, () => {
    console.log(`API escuchando en http://localhost:${config.PORT}`);
  }),
);

function shutdown() {
  server.closeAllConnections(); // las conexiones de avisos en vivo no terminan solas
  server.close(() => {
    void cerrarAvisos().then(() => pool.end()).then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
