import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState, Platform, Pressable } from 'react-native';
import { Texto } from '@/components/ui';
import { Notifications } from '@/lib/notificaciones';
import { useSesion } from '@/session';
import { iniciarCola, vaciar } from '@/sync/cola';
import { MIN_TOQUE } from '@/theme';

// Pila nativa de Expo Router (UINavigationController en iOS): título grande, gesto de volver y modal del sistema.
export default function AppLayout() {
  const { salir, usuario } = useSesion();

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
    <>
      {Platform.OS !== 'web' ? <AbrirAlTocarAviso /> : null}
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
      <Stack.Screen name="nuevo" options={{ presentation: 'modal', headerShown: false }} /> {/* la pantalla trae su propia cabecera con «Cancelar» */}
      <Stack.Screen name="presupuesto/[id]" options={{ title: 'Presupuesto', headerBackTitle: 'Atrás' }} />
      </Stack>
    </>
  );
}

// Tocar un recordatorio abre el presupuesto. Solo en el teléfono: la web no tiene notificaciones locales.
function AbrirAlTocarAviso() {
  const aviso = Notifications.useLastNotificationResponse();
  const quoteId = aviso?.notification.request.content.data?.quoteId;
  useEffect(() => {
    if (typeof quoteId === 'string') router.push({ pathname: '/presupuesto/[id]', params: { id: quoteId } });
  }, [quoteId]);
  return null;
}
