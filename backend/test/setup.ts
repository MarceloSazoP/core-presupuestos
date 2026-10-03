process.env.NODE_ENV = 'test';
if (!process.env.TEST_DATABASE_URL) throw new Error('Falta TEST_DATABASE_URL en backend/.env');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.STORAGE_DIR = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'corepresupuesto-test-'));
