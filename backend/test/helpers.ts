import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { afinarServidor } from '../src/http/servidor';
import { pool } from '../src/db';
import { AppError } from '../src/errors';
import { cerrarAvisos } from '../src/lib/events';
import type { Channel } from '../src/lib/deliver';
import type { Correo } from '../src/lib/mail';
import type { AvisoPush } from '../src/lib/push';

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
export async function startApp(opts: { places?: import('../src/lib/places').Lugares; ipStartLimit?: number; ipExchangeLimit?: number; mailLimit?: number; publicLimit?: number; corsOrigins?: string[] } = {}) {
  const sent: Sent[] = [];
  const mails: Correo[] = [];
  const pushes: { userId: string; aviso: AvisoPush }[] = [];
  const mailState = { fail: false };
  const server: Server = afinarServidor(createApp({
    sendCode: async (channel, destination, code) => void sent.push({ channel, destination, code }),
    sendMail: async (m) => {
      if (mailState.fail) throw new AppError(502, 'DELIVERY_FAILED', 'No se pudo enviar el correo.');
      mails.push(m);
    },
    enviarPush: async (userId, aviso) => void pushes.push({ userId, aviso }),
    ...opts,
  }).listen(0));
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

  // Subida multipart: `file` es el contenido; el nombre y el Content-Type declarados son irrelevantes para el servidor.
  async function upload(method: string, path: string, o: { token?: string; file?: Buffer; fields?: Record<string, string> }) {
    const form = new FormData();
    for (const [k, v] of Object.entries(o.fields ?? {})) form.set(k, v);
    if (o.file) form.set('file', new Blob([new Uint8Array(o.file)], { type: 'image/jpeg' }), 'cualquiera.jpg');
    const res = await fetch(base + path, { method, headers: o.token ? { Authorization: `Bearer ${o.token}` } : {}, body: form });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : undefined };
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

  return { base, api, upload, sent, mails, pushes, mailState, login, close: async () => {
    server.closeAllConnections(); // los avisos en vivo dejan conexiones abiertas
    await cerrarAvisos();
    await new Promise<void>((r) => server.close(() => r()));
  } };
}
