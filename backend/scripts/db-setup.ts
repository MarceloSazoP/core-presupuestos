import { Client, Pool } from 'pg';
import { config } from '../src/config';
import { migrate } from './migrate';

async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';

  const admin = new Client({ connectionString: maintenance.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount) {
      console.log(`BD ya existe: ${name}`);
    } else {
      await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(name)}`);
      console.log(`BD creada: ${name}`);
    }
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: url });
  try {
    const applied = await migrate(pool);
    console.log(`  migraciones: ${applied.length ? applied.join(', ') : 'sin cambios'}`);
  } finally {
    await pool.end();
  }
}

void (async () => {
  for (const url of [config.DATABASE_URL, config.TEST_DATABASE_URL]) {
    if (url) await ensureDatabase(url);
  }
})().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
