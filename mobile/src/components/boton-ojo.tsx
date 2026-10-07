import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { IconButton } from 'react-native-paper';
import { Icono } from '@/components/ui';
import { alternarMontos, useMontosOcultos } from '@/lib/montos';
import { MIN_TOQUE, useTema } from '@/theme';

// El ojo para ocultar o mostrar los montos de un lugar (`clave`, ver lib/montos.ts). Ojo abierto: se ven; tachado: son puntos.
// `chico`: para ir dentro de una fila (el área de toque se agranda con hitSlop).
export function BotonOjo({ clave, color, chico }: { clave: string; color?: string; chico?: boolean }) {
  const t = useTema();
  const oculto = useMontosOcultos(clave);
  const tono = color ?? t.acento;
  const lado = chico ? 28 : MIN_TOQUE;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: oculto }}
      accessibilityLabel={oculto ? 'Montos ocultos. Tocar para mostrarlos' : 'Ocultar los montos'}
      hitSlop={chico ? 12 : 8}
      onPress={() => {
        void Haptics.selectionAsync();
        alternarMontos(clave);
      }}
      style={({ pressed }) => [e.ojo, { width: lado, height: lado, borderRadius: lado / 2 }, oculto && { backgroundColor: `${tono}26` }, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icono nombre={oculto ? 'ojoCerrado' : 'ojo'} tamano={chico ? 16 : 20} color={tono} />
    </Pressable>
  );
}

// El ojo como botón tonal de Material (onda al tocar), junto a un título o un total: el de «Resumen» en Inicio y el del total de la lista
// de Presupuestos. Misma lógica que `BotonOjo`; oculto, el tono es más fuerte.
export function OjoTonal({ clave }: { clave: string }) {
  const t = useTema();
  const oculto = useMontosOcultos(clave);
  return (
    <IconButton
      mode="contained-tonal"
      icon={({ color }) => <Icono nombre={oculto ? 'ojoCerrado' : 'ojo'} tamano={20} color={color} />}
      iconColor={t.acento}
      containerColor={oculto ? `${t.acento}40` : `${t.acento}1F`}
      selected={oculto}
      accessibilityState={{ selected: oculto }}
      accessibilityLabel={oculto ? 'Montos ocultos. Tocar para mostrarlos' : 'Ocultar los montos'}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        alternarMontos(clave);
      }}
      style={e.tonal}
    />
  );
}

const e = StyleSheet.create({
  ojo: { alignItems: 'center', justifyContent: 'center' },
  tonal: { width: MIN_TOQUE, height: MIN_TOQUE, borderRadius: MIN_TOQUE / 2, margin: 0 },
});
