import { Stack } from 'expo-router';
import { Alert, Pressable } from 'react-native';
import { Texto } from '@/components/ui';
import { useSesion } from '@/session';
import { MIN_TOQUE } from '@/theme';

// Pila nativa de Expo Router (UINavigationController en iOS): título grande, gesto de volver y modal del sistema.
export default function AppLayout() {
  const { salir, usuario } = useSesion();

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
