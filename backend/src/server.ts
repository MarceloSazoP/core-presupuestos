import { createApp } from './app';
import { config } from './config';
import { pool } from './db';

const server = createApp().listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`);
});

function shutdown() {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
