import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icono, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Las partes de un presupuesto (Visita · Presupuesto · Enviar · Seguimiento · Detalle) como pestañas fijas de Material 3: el ícono sobre
// el nombre, onda al tocar y, bajo la elegida, la línea indicadora en el color de acento, que se desliza con un resorte (en vez de saltar).
// La elegida lleva ícono y texto en el acento; las demás, en el gris suave. Al tocar suena un toque leve.
export type Parte = { id: string; texto: string; icono: NombreIcono };

export function PestanasParte({ partes, valor, alElegir, etiqueta = 'Partes del presupuesto' }: { partes: readonly Parte[]; valor: string; alElegir: (id: string) => void; etiqueta?: string }) {
  const t = useTema();
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(0, partes.findIndex((p) => p.id === valor));
  const celda = ancho > 0 ? ancho / partes.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(indice * celda, { damping: 26, stiffness: 320, mass: 0.8, reduceMotion: ReduceMotion.System }));
  }, [indice, celda, x]);
  const indicador = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View accessibilityRole="tablist" accessibilityLabel={etiqueta} onLayout={(ev) => setAncho(ev.nativeEvent.layout.width)} style={[e.barra, { borderBottomColor: t.borde }]}>
      {partes.map((p) => {
        const elegida = p.id === valor;
        const color = elegida ? t.acento : t.suave;
        return (
          <TouchableRipple
            key={p.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: elegida }}
            accessibilityLabel={p.texto}
            rippleColor={`${t.acento}29`}
            onPress={() => {
              if (!elegida) void Haptics.selectionAsync();
              alElegir(p.id);
            }}
            style={e.pestana}
          >
            <View style={e.contenido}>
              <Icono nombre={p.icono} tamano={22} color={color} />
              <Text variant="titleSmall" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color }}>{p.texto}</Text>
            </View>
          </TouchableRipple>
        );
      })}
      {/* La línea indicadora de Material bajo la pestaña elegida, con las esquinas de arriba redondeadas. */}
      {celda > 0 ? <Animated.View pointerEvents="none" style={[e.indicador, { width: celda - espacio.xl * 2, backgroundColor: t.acento }, indicador]} /> : null}
    </View>
  );
}

const ALTO_INDICADOR = 3;
const e = StyleSheet.create({
  barra: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  pestana: { flex: 1, minHeight: MIN_TOQUE + 16, justifyContent: 'center', paddingHorizontal: espacio.xs },
  contenido: { alignItems: 'center', gap: 4 },
  indicador: { position: 'absolute', bottom: 0, left: espacio.xl, height: ALTO_INDICADOR, borderTopLeftRadius: ALTO_INDICADOR, borderTopRightRadius: ALTO_INDICADOR },
});
