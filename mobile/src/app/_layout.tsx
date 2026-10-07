import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { PantallaCarga } from '@/components/pantalla-carga';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AvisosFlotantes } from '@/components/avisos-flotantes';
import { BarraTeclado } from '@/components/ui';
import { aplicarTema, leerPreferenciaTema } from '@/lib/preferencia-tema';
import { useTema } from '@/theme';
import { ajustesPaper, temaPaper } from '@/theme-paper';
import { SesionProvider, useSesion } from '@/session';
import { TituloConIcono } from '@/components/titulo-con-icono';

SplashScreen.preventAutoHideAsync();

// Rutas protegidas por la sesión (Expo Router, Stack.Protected): sin sesión solo existe «ingresar»; con sesión, la app.
function Navegador() {
  const { estado } = useSesion();
  const [temaListo, setTemaListo] = useState(false);
  // El tema elegido (claro, oscuro o automático) se aplica antes de mostrar nada, para que no parpadee el otro.
  useEffect(() => {
    void leerPreferenciaTema()
      .then(aplicarTema)
      .catch(() => {}) // si algo falla, la app sigue al sistema: nunca debe quedar esperando el tema
      .finally(() => setTemaListo(true));
  }, []);
  // El splash nativo se oculta al arrancar la interfaz: sigue la pantalla de carga de la app, con el mismo logotipo y un indicador.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  // La pantalla de carga se ve al menos 1,2 s: leer la sesión y el tema tarda unas décimas y, sin ese mínimo, pasaba tan rápido que no se
  // alcanzaba a ver ni el nombre ni el «Iniciando…».
  const [minimo, setMinimo] = useState(false);
  useEffect(() => {
    const h = setTimeout(() => setMinimo(true), 1200);
    return () => clearTimeout(h);
  }, []);
  if (estado === 'cargando' || !temaListo || !minimo) return <PantallaCarga />; // el logotipo y «Iniciando…»; el splash nativo ya se ocultó

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={estado === 'dentro'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'fuera'}>
        <Stack.Screen name="ingresar" />
        <Stack.Screen name="recuperar" options={{ headerShown: true, title: 'Entrar con el QR', presentation: 'modal', headerBackTitle: 'Atrás', headerTitle: () => <TituloConIcono texto="Entrar con el QR" icono={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }} /> }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function Raiz() {
  const esquema = useColorScheme();
  const t = useTema();
  const base = esquema === 'dark' ? DarkTheme : DefaultTheme;
  // Los colores de la navegación nativa (cabecera, fondo de pantalla, acento) son los de la app.
  const tema = { ...base, colors: { ...base.colors, background: t.fondo, card: t.fondo, primary: t.acento, text: t.texto, border: t.borde } };
  const paper = useMemo(() => temaPaper(t), [t]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={tema}>
        {/* Material (React Native Paper) con los colores de la app; por ahora lo usa solo Inicio. */}
        <PaperProvider theme={paper} settings={ajustesPaper}>
          <SesionProvider>
            <Navegador />
            <BarraTeclado />
            <AvisosFlotantes />
          </SesionProvider>
        </PaperProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
