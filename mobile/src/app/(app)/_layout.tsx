import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Notifications } from '@/lib/notificaciones';
import { iniciarCola, vaciar } from '@/sync/cola';
import { MIN_TOQUE, useTema } from '@/theme';

// Pila nativa de Expo Router (UINavigationController en iOS): título grande, gesto de volver y modal del sistema.
export default function AppLayout() {
  const t = useTema();

  useEffect(() => {
    iniciarCola(); // al abrir la app
    const s = AppState.addEventListener('change', (e) => e === 'active' && void vaciar()); // y al volver a primer plano
    return () => s.remove();
  }, []);

  return (
    <>
      {Platform.OS !== 'web' ? <AbrirAlTocarAviso /> : null}
      <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Inicio',
          // Dos íconos: la lista de presupuestos por estado (las pestañas) y configurar.
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver todos los presupuestos" onPress={() => router.push('/presupuestos')} hitSlop={8} style={{ minHeight: MIN_TOQUE, minWidth: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} size={22} tintColor={t.acento} fallback={<View />} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Configurar" onPress={() => router.push('/configurar')} hitSlop={8} style={{ minHeight: MIN_TOQUE, minWidth: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                <SymbolView name="gearshape" size={22} tintColor={t.acento} fallback={<View />} />
              </Pressable>
            </View>
          ),
        }}
      />
      {/* título normal: las pestañas quedan fijas debajo */}
      <Stack.Screen name="presupuestos" options={{ title: 'Presupuestos', headerBackTitle: 'Inicio' }} />
      {/* la pantalla trae su propia cabecera con «Cancelar» */}
      <Stack.Screen name="nuevo" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="codigo" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
      <Stack.Screen name="escanear" options={{ presentation: 'modal', title: 'Ver en la web', headerBackTitle: 'Atrás' }} />
      <Stack.Screen name="configurar" options={{ title: 'Configurar', headerBackTitle: 'Atrás' }} />
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
