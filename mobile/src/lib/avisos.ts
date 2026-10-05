import { useSyncExternalStore } from 'react';
import { Notifications } from '@/lib/notificaciones';
import { api } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { agregarAviso, deNotificacion, marcarLeidos, type Aviso } from '@/lib/avisos-datos';
import { vencidos } from '@/lib/recordatorios';
import { guardarKv, leerKv } from '@/sync/db';
import { Platform } from 'react-native';

// Los avisos que le llegan al teléfono, guardados también dentro de la app (por usuario: la base local se vacía al cambiar de
// cuenta). Se registran al llegar con la app abierta, al abrirla (los que quedaron en el centro de notificaciones) y al tocarlos.
let lista: Aviso[] = [];
const oyentes = new Set<() => void>();
const K = 'avisos';

const emitir = () => oyentes.forEach((f) => f());
const poner = (nueva: Aviso[]) => {
  lista = nueva;
  void guardarKv(K, JSON.stringify(nueva));
  emitir();
};

export const useAvisos = () => useSyncExternalStore((f) => (oyentes.add(f), () => void oyentes.delete(f)), () => lista);

// La lista guardada se lee una sola vez, y todo lo que la cambia espera a esa lectura: al tocar un aviso con la app cerrada, el
// toque llega antes de que termine de leerse y, sin esperar, la lista vacía pisaría lo guardado (se perdería lo leído).
let lectura: Promise<void> | null = null;
const cargada = () => (lectura ??= (async () => {
  lista = JSON.parse((await leerKv(K)) ?? '[]') as Aviso[];
  emitir();
})());

export const marcarLeido = async (id?: string) => {
  await cargada();
  poner(marcarLeidos(lista, id));
};
export const borrarAvisos = async () => {
  await cargada();
  poner([]);
};
export const registrarAviso = async (a: Aviso) => {
  await cargada();
  const nueva = agregarAviso(lista, a);
  if (nueva !== lista) poner(nueva);
};

// Los que quedaron en el centro de notificaciones del teléfono mientras la app estaba cerrada. Solo se registran: que estén ahí no
// quiere decir que se hayan leído, así que quedan como no leídos hasta que la persona los toque o los marque.
export async function traerPendientes() {
  if (Platform.OS === 'web') return;
  try {
    for (const n of await Notifications.getPresentedNotificationsAsync()) await registrarAviso(deNotificacion(n));
  } catch {
    // sin permiso o sin soporte: la bandeja se llena solo con lo que llega con la app abierta
  }
}

// Los avisos que ya debieron sonar según los presupuestos: quedan en la bandeja aunque la persona haya borrado la notificación del
// teléfono sin tocarla (como en WhatsApp: lo que llegó queda). Se revisa al abrir la app y al volver a ella.
export async function sincronizarAvisos() {
  try {
    const { data } = await api<{ data: ResumenPresupuesto[] }>('/quotes?limit=100');
    for (const a of vencidos(data)) await registrarAviso(a);
  } catch {
    // sin conexión: se revisa la próxima vez
  }
}

let iniciado = false;
export async function iniciarAvisos() {
  if (iniciado || Platform.OS === 'web') return;
  iniciado = true;
  await cargada();
  Notifications.addNotificationReceivedListener((n) => void registrarAviso(deNotificacion(n)));
  await traerPendientes();
  await sincronizarAvisos();
}

// Al cambiar de cuenta la bandeja se vuelve a leer (la base local se vació).
export async function recargarAvisos() {
  lectura = null;
  await cargada();
}
