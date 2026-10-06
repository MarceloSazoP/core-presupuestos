import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icono, Texto, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Las partes de un presupuesto (Visita · Presupuesto · Enviar · Seguimiento · Detalle) y también las secciones de Configurar, como pestañas con ícono. Una pista con borde fino
// sobre la tarjeta y, debajo de la pestaña elegida, una pastilla suave del color de acento que se desliza con un resorte (en vez de
// saltar). La elegida lleva ícono y texto en el color de acento; las demás, en el gris suave. Al tocar suena un toque leve.
export type Parte = { id: string; texto: string; icono: NombreIcono };

export function PestanasParte({ partes, valor, alElegir, etiqueta = 'Partes del presupuesto' }: { partes: readonly Parte[]; valor: string; alElegir: (id: string) => void; etiqueta?: string }) {
  const t = useTema();
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(0, partes.findIndex((p) => p.id === valor));
  const celda = ancho > 0 ? (ancho - PAD * 2) / partes.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(indice * celda, { damping: 26, stiffness: 320, mass: 0.8, reduceMotion: ReduceMotion.System }));
  }, [indice, celda, x]);
  const pastilla = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View accessibilityRole="tablist" accessibilityLabel={etiqueta} onLayout={(ev) => setAncho(ev.nativeEvent.layout.width)} style={[e.pista, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
      {celda > 0 ? <Animated.View pointerEvents="none" style={[e.pastilla, { width: celda, backgroundColor: `${t.acento}1F` }, pastilla]} /> : null}
      {partes.map((p) => {
        const elegida = p.id === valor;
        const color = elegida ? t.acento : t.suave;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: elegida }}
            accessibilityLabel={p.texto}
            onPress={() => {
              if (!elegida) void Haptics.selectionAsync();
              alElegir(p.id);
            }}
            style={e.pestana}
          >
            <Icono nombre={p.icono} tamano={18} color={color} />
            <Texto variante="chico" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color, fontWeight: elegida ? '600' : '500' }}>{p.texto}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const PAD = 4;
const e = StyleSheet.create({
  pista: { flexDirection: 'row', padding: PAD, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous' },
  pastilla: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radio.m, borderCurve: 'continuous' },
  pestana: { flex: 1, minHeight: MIN_TOQUE + 4, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: espacio.xs },
});
