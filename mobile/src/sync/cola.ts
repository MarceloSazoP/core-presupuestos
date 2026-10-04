import { useSyncExternalStore } from 'react';
import { api, ApiError, subir } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { guardarCodigo } from '@/lib/codigos';
import { borrarArchivo, existeArchivo } from './archivos';
import { agregarOp, borrarOp, cambiarOp, guardarKv, leerKv, limpiarTodo, listarKv, ops, type Op } from './db';
import { bloqueo, esTransitorio, espera, reemplazadas } from './reglas';

// Cola de envío (Arquitectura §5): toda edición se guarda primero en el teléfono y se envía después, en orden. La
// interfaz nunca espera a la red; el `id` generado aquí hace seguros los reintentos (Contrato API §1).

// ── Borradores locales (copia de trabajo de cada presupuesto) ─────────────────────────────────
export const guardarBorrador = (q: Presupuesto) => guardarKv(`q:${q.id}`, JSON.stringify(q));
export const leerBorrador = async (id: string) => {
  const v = await leerKv(`q:${id}`);
  return v ? (JSON.parse(v) as Presupuesto | null) : null;
};
export const borradores = async () => (await listarKv('q:')).map((v) => JSON.parse(v) as Presupuesto | null).filter((q) => q !== null);

// Los datos locales son de un usuario: si entra otro en el mismo teléfono, no se mezclan ni se envían con su sesión.
export async function usarDatosDe(usuarioId: string) {
  if ((await leerKv('dueno')) !== usuarioId) await limpiarTodo();
  await guardarKv('dueno', usuarioId);
}

// ── Estado visible (indicador de pendientes) ──────────────────────────────────────────────────
type Estado = { pendientes: number; fallidas: number };
let estado: Estado = { pendientes: 0, fallidas: 0 };
const oyentes = new Set<() => void>();

async function refrescar() {
  const todas = await ops();
  const nuevo = { pendientes: todas.filter((o) => o.state === 'pending').length, fallidas: todas.filter((o) => o.state === 'failed').length };
  if (nuevo.pendientes === estado.pendientes && nuevo.fallidas === estado.fallidas) return;
  estado = nuevo;
  oyentes.forEach((f) => f());
}
const suscribir = (f: () => void) => (oyentes.add(f), () => void oyentes.delete(f));
export const useCola = () => useSyncExternalStore(suscribir, () => estado);

// ── Encolar ───────────────────────────────────────────────────────────────────────────────────
type Entrada = { quote_id: string; method: string; path: string; body?: unknown; archivo?: { uri: string; name: string; type: string }; fields?: Record<string, string> };

export async function encolar(o: Entrada) {
  const nueva = {
    quote_id: o.quote_id, method: o.method, path: o.path, body: o.body === undefined ? null : JSON.stringify(o.body),
    file_uri: o.archivo?.uri ?? null, file_name: o.archivo?.name ?? null, file_type: o.archivo?.type ?? null, fields: o.fields ? JSON.stringify(o.fields) : null,
  };
  for (const seq of reemplazadas(await ops(), nueva)) await borrarOp(seq);
  await agregarOp(nueva);
  await refrescar();
  void vaciar();
}

// Quitar algo que aún no se subió: basta con sacarlo de la cola. Devuelve false si ya no estaba (ya subió o está subiendo).
export async function descartarSubida(quoteId: string, id: string) {
  const op = (await ops()).find((o) => o.quote_id === quoteId && o.file_uri && JSON.parse(o.fields ?? '{}').id === id);
  if (!op) return false;
  await borrarOp(op.seq);
  borrarArchivo(op.file_uri!);
  await refrescar();
  return true;
}

export const creacionesPendientes = async () => (await ops()).filter((o) => o.method === 'POST' && o.path === '/quotes').map((o) => o.quote_id);
export const hayPendientesDe = async (quoteId: string) => (await ops()).some((o) => o.quote_id === quoteId);

// Antes de una acción en línea hay que haber enviado lo local (Arquitectura §5, regla 8). `alcance` en reglas.ts.
export async function asegurarSincronizado(quoteId: string, alcance: 'creacion' | 'todo' = 'creacion') {
  await vaciar();
  const motivo = bloqueo(await ops(), quoteId, alcance);
  if (motivo) throw new ApiError(0, 'SIN_SINCRONIZAR', motivo);
}

// ── Vaciar la cola ────────────────────────────────────────────────────────────────────────────
let corriendo: Promise<void> | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;
export const vaciar = () => (corriendo ??= correr().finally(() => (corriendo = null)));

const registro = (...a: unknown[]) => __DEV__ && console.log('[cola]', ...a);

async function enviar(o: Op) {
  registro('enviando', o.method, o.path, o.file_uri ?? '', o.file_uri ? `existe=${existeArchivo(o.file_uri)}` : '');
  if (o.file_uri && !existeArchivo(o.file_uri)) throw new ApiError(422, 'ARCHIVO_PERDIDO', 'El archivo ya no está en el teléfono: vuelve a tomar la foto o grabar la nota.');
  const r = o.file_uri
    ? await subir<unknown>(o.path, { uri: o.file_uri, name: o.file_name!, type: o.file_type! }, JSON.parse(o.fields ?? '{}'))
    : await api<unknown>(o.path, { method: o.method, body: o.body ? JSON.parse(o.body) : undefined });
  // El código del presupuesto solo llega al crearlo: se guarda en el teléfono (el servidor no lo puede repetir).
  const creado = r as { id?: string; access_code?: string } | undefined;
  if (o.path === '/quotes' && creado?.access_code && creado.id) await guardarCodigo(creado.id, creado.access_code);
}

async function correr() {
  clearTimeout(temporizador);
  const bloqueados = new Set<string>(); // si una operación falla para siempre, las siguientes del mismo presupuesto esperan
  let siguiente: number | null = null;
  for (const o of await ops()) {
    if (o.state === 'failed') { bloqueados.add(o.quote_id); continue; }
    if (bloqueados.has(o.quote_id)) continue;
    try {
      await enviar(o);
      registro('ok', o.method, o.path);
      await borrarOp(o.seq);
      if (o.file_uri) borrarArchivo(o.file_uri);
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError(0, 'SIN_CONEXION', String(err));
      registro('falló', o.method, o.path, `status=${e.status}`, e.message);
      if (e.status === 401) break; // la sesión venció: api() ya la cerró
      if (esTransitorio(e.status)) {
        await cambiarOp(o.seq, { attempts: o.attempts + 1, last_error: e.message });
        siguiente = espera(o.attempts);
        break; // sin red para una, sin red para todas: se conserva el orden
      }
      await cambiarOp(o.seq, { state: 'failed', last_error: e.details.length ? e.details.map((d) => d.message).join('. ') : e.message });
      bloqueados.add(o.quote_id);
    }
  }
  await refrescar();
  if (siguiente !== null) temporizador = setTimeout(() => void vaciar(), siguiente);
}

// ── Operaciones que fallaron: reintentar o descartar ──────────────────────────────────────────
export const fallidas = async () => (await ops()).filter((o) => o.state === 'failed');

export async function reintentarFallidas() {
  for (const o of await fallidas()) await cambiarOp(o.seq, { state: 'pending', attempts: 0 });
  await refrescar();
  void vaciar();
}

// Descarta todo lo pendiente de los presupuestos con errores; el borrador local de uno que nunca se creó también se va.
export async function descartarFallidas() {
  const quotes = new Set((await fallidas()).map((o) => o.quote_id));
  for (const o of await ops()) {
    if (!quotes.has(o.quote_id)) continue;
    await borrarOp(o.seq);
    if (o.file_uri) borrarArchivo(o.file_uri);
    if (o.method === 'POST' && o.path === '/quotes') await guardarKv(`q:${o.quote_id}`, 'null');
  }
  await refrescar();
}

export const iniciarCola = () => void refrescar().then(() => vaciar());
