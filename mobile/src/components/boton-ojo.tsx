import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
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

const e = StyleSheet.create({
  ojo: { alignItems: 'center', justifyContent: 'center' },
});
