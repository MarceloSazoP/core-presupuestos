import { useSyncExternalStore } from 'react';
import { Notifications } from '@/lib/notificaciones';
import { agregarAviso, deNotificacion, marcarLeidos, type Aviso } from '@/lib/avisos-datos';
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
export const marcarLeido = (id?: string) => poner(marcarLeidos(lista, id));
export const borrarAvisos = () => poner([]);
export const registrarAviso = (a: Aviso) => {
  const nueva = agregarAviso(lista, a);
  if (nueva !== lista) poner(nueva);
};

// Los que quedaron en el centro de notificaciones del teléfono mientras la app estaba cerrada.
export async function traerPendientes() {
  if (Platform.OS === 'web') return;
  try {
    for (const n of await Notifications.getPresentedNotificationsAsync()) registrarAviso(deNotificacion(n));
  } catch {
    // sin permiso o sin soporte: la bandeja se llena solo con lo que llega con la app abierta
  }
}

let iniciado = false;
export async function iniciarAvisos() {
  if (iniciado || Platform.OS === 'web') return;
  iniciado = true;
  lista = JSON.parse((await leerKv(K)) ?? '[]') as Aviso[];
  emitir();
  Notifications.addNotificationReceivedListener((n) => registrarAviso(deNotificacion(n)));
  await traerPendientes();
}

// Al cambiar de cuenta la bandeja se vuelve a leer (la base local se vació).
export async function recargarAvisos() {
  lista = JSON.parse((await leerKv(K)) ?? '[]') as Aviso[];
  emitir();
}
