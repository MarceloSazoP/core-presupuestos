import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import type { Channel } from '../src/lib/deliver';

export type Sent = { channel: Channel; destination: string; code: string };

export async function assertTestDb() {
  const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
  assert.ok(rows[0]!.db.endsWith('-test'), `Las pruebas solo corren en una BD *-test, no en ${rows[0]!.db}`);
}

// Vacía lo que crean las pruebas de la API (solo en la BD *-test).
export async function resetDb() {
  await assertTestDb();
  await pool.query('TRUNCATE users, auth_challenges, audit_events, quote_counters CASCADE');
}

// Levanta la app en un puerto efímero con un "enviador" falso que guarda los códigos en vez de mandarlos.
export async function startApp(opts: { ipStartLimit?: number; ipExchangeLimit?: number } = {}) {
  const sent: Sent[] = [];
  const server: Server = createApp({
    sendCode: async (channel, destination, code) => void sent.push({ channel, destination, code }),
    ...opts,
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  async function api(method: string, path: string, o: { token?: string; body?: unknown; raw?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(o.token && { Authorization: `Bearer ${o.token}` }), ...((o.body !== undefined || o.raw !== undefined) && { 'Content-Type': 'application/json' }) },
      body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body)),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
  }

  // Registra (o ingresa) y devuelve el token y el usuario.
  async function login(phone: string, email: string, name = 'Test') {
    const start = await api('POST', '/auth/start', { body: { phone, name, email, channel: 'EMAIL' } });
    assert.equal(start.status, 202);
    const code = sent.at(-1)!.code;
    const v = await api('POST', '/auth/verify', { body: { challenge_id: start.json.challenge_id, code } });
    assert.equal(v.status, 200);
    return { token: v.json.token as string, user: v.json.user as { id: string } };
  }

  return { api, sent, login, close: () => new Promise<void>((r) => server.close(() => r())) };
}
