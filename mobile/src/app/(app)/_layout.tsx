import { router, Stack } from 'expo-router';
import { LISTA } from '@/lib/montos';
import { BotonOjo } from '@/components/boton-ojo';
import { TituloIr } from '@/components/titulo-ir';
import { useEffect } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { TituloConIcono } from '@/components/titulo-con-icono';
import { iniciarAvisos, marcarLeido, registrarAviso, sincronizarAvisos, traerPendientes, useAvisos } from '@/lib/avisos';
import { deNotificacion, sinLeer } from '@/lib/avisos-datos';
import { Notifications } from '@/lib/notificaciones';
import { iniciarCola, vaciar } from '@/sync/cola';
import { MIN_TOQUE, useTema } from '@/theme';

const INICIO_PANTALLA = { texto: 'Inicio', icono: { ios: 'house.fill', android: 'home', web: 'home' } } as const;
const PRESUPUESTOS_PANTALLA = { texto: 'Presupuestos', icono: { ios: 'doc.text.fill', android: 'description', web: 'description' } } as const;

// Pila nativa de Expo Router (UINavigationController en iOS): título grande, gesto de volver y modal del sistema.
export default function AppLayout() {
  const t = useTema();

  useEffect(() => {
    iniciarCola(); // al abrir la app
    void iniciarAvisos(); // la bandeja de avisos del teléfono
    const s = AppState.addEventListener('change', (e) => {
      if (e !== 'active') return;
      void vaciar(); // al volver a primer plano
      void traerPendientes(); // y se recogen los avisos que llegaron mientras no estaba
      void sincronizarAvisos(); // incluso los que la persona borró del teléfono sin tocarlos
    });
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
          // El título lleva a Presupuestos («Inicio → Presupuestos»); a la izquierda, configurar; a la derecha, los avisos.
          headerTitle: () => <TituloIr sentido="adelante" actual={INICIO_PANTALLA} destino={PRESUPUESTOS_PANTALLA} alIr={() => router.push('/presupuestos')} />,
          headerLeft: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Configurar" onPress={() => router.push('/configurar')} hitSlop={8} style={{ minHeight: MIN_TOQUE, minWidth: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
              <SymbolView name="gearshape" size={22} tintColor={t.acento} fallback={<View />} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <CampanaAvisos />
            </View>
          ),
        }}
      />
      {/* título normal: las pestañas quedan fijas debajo */}
      <Stack.Screen name="avisos" options={{ title: 'Avisos', headerBackTitle: 'Inicio', headerTitle: () => <TituloConIcono texto="Avisos" icono={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} /> }} />
      <Stack.Screen name="presupuestos" options={{ title: 'Presupuestos', headerBackTitle: 'Inicio', gestureEnabled: false, headerRight: () => <BotonOjo clave={LISTA} />, headerTitle: () => <TituloIr sentido="atras" actual={PRESUPUESTOS_PANTALLA} destino={INICIO_PANTALLA} alIr={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> }} />
      {/* la pantalla trae su propia cabecera con «Cancelar» */}
      <Stack.Screen name="nuevo" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="codigo" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
      <Stack.Screen name="escanear" options={{ presentation: 'modal', title: 'Ver en la web', headerBackTitle: 'Atrás' }} />
      <Stack.Screen name="configurar" options={{ title: 'Configurar', headerBackTitle: 'Atrás', headerTitle: () => <TituloConIcono texto="Configurar" icono={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} /> }} />
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
    if (!aviso) return;
    const a = deNotificacion(aviso.notification); // quedó en la bandeja de avisos, ya leído
    void registrarAviso(a).then(() => marcarLeido(a.id)); // tocar el aviso (en la pantalla de bloqueo, por ejemplo) es lo que lo marca como leído
    if (typeof quoteId === 'string') router.push({ pathname: '/presupuesto/[id]', params: { id: quoteId } });
  }, [aviso, quoteId]);
  return null;
}

// La campana de la barra: abre los avisos y muestra cuántos hay sin leer.
function CampanaAvisos() {
  const t = useTema();
  const sin = sinLeer(useAvisos());
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={sin ? `Avisos, ${sin} sin leer` : 'Avisos'} onPress={() => router.push('/avisos')} hitSlop={8} style={{ minHeight: MIN_TOQUE, minWidth: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} size={22} tintColor={t.acento} fallback={<View />} />
      {sin ? (
        <View style={[e.insignia, { backgroundColor: t.error }]}>
          <Text style={e.insigniaTexto}>{sin > 9 ? '9+' : sin}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const e = StyleSheet.create({
  insignia: { position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
