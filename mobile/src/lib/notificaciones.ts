import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { PREFIJO, planificar } from './recordatorios';

// Recordatorios locales del próximo contacto (Arquitectura §5): se programan en el teléfono, sin servidor. Solo suenan
// en el dispositivo que los programó. La web (vista previa de desarrollo) no los soporta.
const disponible = Platform.OS !== 'web';

if (disponible) {
  // Con la app abierta también se muestra el aviso.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

// El permiso se pide la primera vez que se programa una fecha, no al abrir la app. false si la persona lo rechazó.
export async function pedirPermiso(): Promise<boolean> {
  if (!disponible) return false;
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  if (!actual.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Deja programado exactamente lo que corresponde según los presupuestos. Sin permiso no hace nada (no insiste).
export async function reconciliar(quotes: ResumenPresupuesto[]) {
  if (!disponible || !(await Notifications.getPermissionsAsync()).granted) return;
  try {
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    const { programar, cancelar } = planificar(quotes, programadas.map((n) => n.identifier));
    await Promise.all(cancelar.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    for (const a of programar) {
      await Notifications.scheduleNotificationAsync({
        identifier: a.identifier,
        content: { title: a.titulo, body: a.cuerpo, data: { quoteId: a.quoteId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.fecha },
      });
    }
  } catch {
    // los recordatorios son una ayuda: si el sistema falla, la app sigue funcionando
  }
}

// «Tu cliente aceptó»: con push, el aviso llega del servidor (lib/push.ts). Sin push en este teléfono (Expo Go en Android, por ejemplo),
// sale de aquí cuando la lista lo detecta con la app abierta. El mismo texto que el del servidor.
export async function avisarAceptado(q: { id: string; number: string | null; customer: { name: string } }) {
  if (!disponible || !(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Presupuesto aceptado', body: `${q.customer.name} aceptó el presupuesto${q.number ? ` ${q.number}` : ''}.`, data: { quoteId: q.id, tipo: 'aceptado' } },
    trigger: null, // ahora
  }).catch(() => {});
}

// Al eliminar un presupuesto su aviso no debe sonar.
export const cancelarRecordatorio = (quoteId: string) => (disponible ? Notifications.cancelScheduledNotificationAsync(PREFIJO + quoteId).catch(() => {}) : Promise.resolve());

// Después de cambiar un seguimiento: se vuelve a leer la lista y se reconcilia.
export const sincronizarRecordatorios = () =>
  api<{ data: ResumenPresupuesto[] }>('/quotes?limit=100').then((r) => reconciliar(r.data)).catch(() => {});

export { Notifications };
