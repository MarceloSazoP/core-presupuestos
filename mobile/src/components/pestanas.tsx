import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Filtro de estados como pestañas de Material 3 (desplazables): cada estado es su nombre y, al lado, cuántos hay (en gris; en el acento el
// elegido), con onda al tocar y 48 de alto. Bajo el elegido, la línea indicadora de Material (en el acento, del ancho del texto) se desliza
// con un resorte (no salta). Con seis estados la fila se desliza de lado; al elegir uno solo se mueve lo justo para que el elegido se vea
// entero: si ya se ve, no se mueve.
const ALTO_INDICADOR = 3;
const RELLENO = espacio.m; // a cada lado del texto de una pestaña; la línea indicadora no lo cubre

export function Pestanas({ activa, cuentas, alElegir }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void }) {
  const t = useTema();
  const barra = useRef<ScrollView>(null);
  const medidas = useRef<Partial<Record<Pestana, { x: number; ancho: number }>>>({});
  const desplazado = useRef(0); // cuánto se ha deslizado la fila
  const visible = useRef(0); // ancho de la fila en pantalla
  const x = useSharedValue(0);
  const ancho = useSharedValue(0);
  const colocada = useRef(false); // la línea se coloca sin animar la primera vez

  // Mueve la fila solo si el estado no se ve entero, y lo justo.
  const mostrar = (id: Pestana, animado: boolean) => {
    const m = medidas.current[id];
    if (!m || !visible.current) return;
    const margen = espacio.m;
    if (m.x - margen < desplazado.current) barra.current?.scrollTo({ x: Math.max(0, m.x - margen), animated: animado });
    else if (m.x + m.ancho + margen > desplazado.current + visible.current) barra.current?.scrollTo({ x: m.x + m.ancho + margen - visible.current, animated: animado });
  };

  // La línea indicadora va a donde está el estado elegido (con resorte); la primera vez, directo.
  const colocar = useCallback(() => {
    const m = medidas.current[activa];
    if (!m) return;
    const destinoX = m.x + RELLENO;
    const destinoAncho = m.ancho - RELLENO * 2;
    if (!colocada.current) {
      x.set(destinoX);
      ancho.set(destinoAncho);
      colocada.current = true;
      return;
    }
    const resorte = { damping: 26, stiffness: 340, mass: 0.8, reduceMotion: ReduceMotion.System };
    x.set(withSpring(destinoX, resorte));
    ancho.set(withSpring(destinoAncho, resorte));
  }, [activa, x, ancho]);
  useEffect(() => {
    mostrar(activa, true);
    colocar();
  }, [activa, colocar]);

  const indicador = useAnimatedStyle(() => ({ width: ancho.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View accessibilityRole="tablist" style={[e.contenedor, { backgroundColor: t.fondo, borderBottomColor: t.borde }]}>
      <ScrollView
        ref={barra}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={e.barra}
        scrollEventThrottle={32}
        onScroll={(ev) => (desplazado.current = ev.nativeEvent.contentOffset.x)}
        onLayout={(ev) => {
          visible.current = ev.nativeEvent.layout.width;
          mostrar(activa, false);
        }}
      >
        <View style={e.fila}>
          {PESTANAS.map((p) => {
            const elegida = p.id === activa;
            const color = elegida ? t.acento : t.suave;
            return (
              <TouchableRipple
                key={p.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: elegida }}
                accessibilityLabel={`${p.texto}, ${cuentas[p.id]}`}
                rippleColor={`${t.acento}29`}
                onLayout={(ev) => {
                  medidas.current[p.id] = { x: ev.nativeEvent.layout.x, ancho: ev.nativeEvent.layout.width };
                  if (elegida) {
                    mostrar(p.id, false);
                    if (!colocada.current) colocar();
                  }
                }}
                onPress={() => {
                  if (!elegida) void Haptics.selectionAsync();
                  alElegir(p.id);
                }}
                style={e.pestana}
              >
                <View style={e.contenido}>
                  <Text variant="titleSmall" style={[e.texto, { color }]}>{p.texto}</Text>
                  <Text variant="bodyMedium" style={[e.numero, { color }]}>{cuentas[p.id]}</Text>
                </View>
              </TouchableRipple>
            );
          })}
          {/* La línea indicadora de Material: va bajo el texto de la pestaña elegida, con las esquinas de arriba redondeadas. */}
          <Animated.View pointerEvents="none" style={[e.indicador, { backgroundColor: t.acento }, indicador]} />
        </View>
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  contenedor: { borderBottomWidth: StyleSheet.hairlineWidth },
  barra: { paddingHorizontal: espacio.xs },
  fila: { flexDirection: 'row', gap: espacio.xs },
  pestana: { minHeight: MIN_TOQUE, justifyContent: 'center', paddingHorizontal: RELLENO },
  contenido: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  texto: { fontWeight: '600' },
  numero: { fontSize: 13, fontVariant: ['tabular-nums'] },
  indicador: { position: 'absolute', bottom: 0, left: 0, height: ALTO_INDICADOR, borderTopLeftRadius: ALTO_INDICADOR, borderTopRightRadius: ALTO_INDICADOR },
});
