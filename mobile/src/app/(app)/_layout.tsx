import { router, Stack } from 'expo-router';
import { LISTA } from '@/lib/montos';
import { BotonOjo } from '@/components/boton-ojo';
import { MenuInicio } from '@/components/menu-inicio';
import { TituloIr } from '@/components/titulo-ir';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { TituloConIcono } from '@/components/titulo-con-icono';
import { iniciarAvisos, marcarLeido, registrarAviso, sincronizarAvisos, traerPendientes } from '@/lib/avisos';
import { deNotificacion } from '@/lib/avisos-datos';
import { Notifications } from '@/lib/notificaciones';
import { iniciarCola, vaciar } from '@/sync/cola';

const INICIO_PANTALLA = { texto: 'Inicio', icono: { ios: 'house.fill', android: 'home', web: 'home' } } as const;
const PRESUPUESTOS_PANTALLA = { texto: 'Presupuestos', icono: { ios: 'doc.text.fill', android: 'description', web: 'description' } } as const;

// Pila nativa de Expo Router (UINavigationController en iOS): título grande, gesto de volver y modal del sistema.
export default function AppLayout() {
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
          // El título lleva a Presupuestos (el selector [Inicio | Presupuestos]); a la derecha, el ☰ con los avisos y configurar.
          headerTitle: () => <TituloIr sentido="adelante" actual={INICIO_PANTALLA} destino={PRESUPUESTOS_PANTALLA} alIr={() => router.push('/presupuestos')} />,
          headerRight: () => <MenuInicio />,
        }}
      />
      {/* título normal: las pestañas quedan fijas debajo */}
      <Stack.Screen name="avisos" options={{ title: 'Avisos', headerBackTitle: 'Inicio', headerTitle: () => <TituloConIcono texto="Avisos" icono={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} /> }} />
      {/* Presupuestos: el selector [Inicio | Presupuestos] reemplaza al botón de volver (son secciones del mismo nivel); el gesto de
          volver de iPhone y «atrás» de Android siguen llevando a Inicio. */}
      <Stack.Screen name="presupuestos" options={{ title: 'Presupuestos', headerBackVisible: false, headerRight: () => <BotonOjo clave={LISTA} />, headerTitle: () => <TituloIr sentido="atras" actual={PRESUPUESTOS_PANTALLA} destino={INICIO_PANTALLA} alIr={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> }} />
      {/* la pantalla trae su propia cabecera con «Cancelar» */}
      <Stack.Screen name="nuevo" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="codigo" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
      <Stack.Screen name="escanear" options={{ presentation: 'modal', title: 'Ver en la web', headerBackTitle: 'Atrás', headerTitle: () => <TituloConIcono texto="Ver en la web" icono={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} /> }} />
      <Stack.Screen name="configurar" options={{ title: 'Configurar', headerBackTitle: 'Atrás', headerTitle: () => <TituloConIcono texto="Configurar" icono={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} /> }} />
      <Stack.Screen name="configurar-datos" options={{ title: 'Mis datos', headerBackTitle: 'Configurar', headerTitle: () => <TituloConIcono texto="Mis datos" icono={{ ios: 'person.fill', android: 'person', web: 'person' }} /> }} />
      <Stack.Screen name="configurar-imagenes" options={{ title: 'Logo y firma', headerBackTitle: 'Configurar', headerTitle: () => <TituloConIcono texto="Logo y firma" icono={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} /> }} />
      <Stack.Screen name="configurar-pais" options={{ title: 'País', headerBackTitle: 'Configurar', headerTitle: () => <TituloConIcono texto="País" icono={{ ios: 'globe', android: 'public', web: 'public' }} /> }} />
      <Stack.Screen name="configurar-apariencia" options={{ title: 'Apariencia', headerBackTitle: 'Configurar', headerTitle: () => <TituloConIcono texto="Apariencia" icono={{ ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' }} /> }} />
      <Stack.Screen name="configurar-informacion" options={{ title: 'Información', headerBackTitle: 'Configurar', headerTitle: () => <TituloConIcono texto="Información" icono={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} /> }} />
      <Stack.Screen name="configurar-cuenta" options={{ title: 'Mi cuenta', headerBackTitle: 'Configurar', headerTitle: () => <TituloConIcono texto="Mi cuenta" icono={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }} /> }} />
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
