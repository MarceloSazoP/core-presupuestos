import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState, Pressable } from 'react-native';
import { Texto } from '@/components/ui';
import { Notifications } from '@/lib/notificaciones';
import { useSesion } from '@/session';
import { iniciarCola, vaciar } from '@/sync/cola';
import { MIN_TOQUE } from '@/theme';

// Pila nativa de Expo Router (UINavigationController en iOS): título grande, gesto de volver y modal del sistema.
export default function AppLayout() {
  const { salir, usuario } = useSesion();

  // Tocar un recordatorio abre el presupuesto.
  const aviso = Notifications.useLastNotificationResponse();
  const quoteId = aviso?.notification.request.content.data?.quoteId;
  useEffect(() => {
    if (typeof quoteId === 'string') router.push({ pathname: '/presupuesto/[id]', params: { id: quoteId } });
  }, [quoteId]);

  useEffect(() => {
    iniciarCola(); // al abrir la app
    const s = AppState.addEventListener('change', (e) => e === 'active' && void vaciar()); // y al volver a primer plano
    return () => s.remove();
  }, []);

  const confirmarSalida = () =>
    Alert.alert('Cerrar sesión', `Saldrás de la cuenta de ${usuario?.name ?? 'tu usuario'}. Tus presupuestos quedan guardados.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void salir() },
    ]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Presupuestos',
          headerLargeTitle: true,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={confirmarSalida} hitSlop={8} style={{ minHeight: MIN_TOQUE, justifyContent: 'center' }}>
              <Texto color="acento">Salir</Texto>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="nuevo" options={{ title: 'Nuevo presupuesto', presentation: 'modal' }} />
      <Stack.Screen name="presupuesto/[id]" options={{ title: 'Presupuesto', headerBackTitle: 'Atrás' }} />
    </Stack>
  );
}
