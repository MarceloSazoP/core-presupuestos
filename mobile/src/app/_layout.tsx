import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BarraTeclado } from '@/components/ui';
import { useTema } from '@/theme';
import { SesionProvider, useSesion } from '@/session';

SplashScreen.preventAutoHideAsync();

// Rutas protegidas por la sesión (Expo Router, Stack.Protected): sin sesión solo existe «ingresar»; con sesión, la app.
function Navegador() {
  const { estado } = useSesion();
  useEffect(() => {
    if (estado !== 'cargando') void SplashScreen.hideAsync(); // el splash cubre la lectura del token guardado
  }, [estado]);
  if (estado === 'cargando') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={estado === 'dentro'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'fuera'}>
        <Stack.Screen name="ingresar" />
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={tema}>
        <SesionProvider>
          <Navegador />
          <BarraTeclado />
        </SesionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
