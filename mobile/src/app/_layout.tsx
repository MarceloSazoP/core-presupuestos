import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
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
  return (
    <ThemeProvider value={esquema === 'dark' ? DarkTheme : DefaultTheme}>
      <SesionProvider>
        <Navegador />
      </SesionProvider>
    </ThemeProvider>
  );
}
