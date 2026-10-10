import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { avisarCambio } from '@/lib/eventos';
import { Notifications, pedirPermiso } from '@/lib/notificaciones';

// Notificaciones push (Arquitectura §5, decisión del 2026-10-10): hoy, que el cliente aceptó un presupuesto. El token de este teléfono
// se guarda en la API, que avisa por el servicio de Expo aunque la app esté cerrada. Si no se puede (Expo Go en Android, sin permiso,
// sin red), la app sigue igual: se entera al refrescar la lista y avisa con una notificación local (ver `pushActivo`).
const disponible = Platform.OS !== 'web';
let registrado: string | null = null;
export const pushActivo = () => registrado !== null;

if (disponible) {
  // Con la app abierta, la lista y el presupuesto se actualizan al llegar el aviso (el sistema igual lo muestra).
  Notifications.addNotificationReceivedListener((n) => {
    const d = n.request.content.data;
    if (d?.tipo === 'aceptado' && typeof d.quoteId === 'string') avisarCambio(d.quoteId);
  });
}

// `pedir`: si falta el permiso, se pide (al enviar un presupuesto, que es cuando el aviso tiene sentido). Sin `pedir`, solo se
// renueva el registro si el permiso ya está dado (al abrir la app).
export async function registrarPush(pedir = false) {
  if (!disponible) return;
  try {
    // Android solo muestra un aviso si su canal existe en el teléfono: el mismo «default» que usa la API al enviarlo.
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Avisos', importance: Notifications.AndroidImportance.HIGH });
    const permiso = pedir ? await pedirPermiso() : (await Notifications.getPermissionsAsync()).granted;
    if (!permiso) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (token === registrado) return;
    await api('/me/push-token', { method: 'PUT', body: { token } });
    registrado = token;
  } catch {
    // sin push (Expo Go en Android, emulador sin Google Play o sin red): no es un error para la persona
  }
}

// Al cerrar sesión, este teléfono deja de recibir los avisos de esa cuenta. `token`: el de la sesión, que ya se está borrando.
export async function olvidarPush(token: string | null) {
  const push = registrado;
  registrado = null;
  if (push && token) await api('/me/push-token', { method: 'DELETE', body: { token: push }, token }).catch(() => {});
}
