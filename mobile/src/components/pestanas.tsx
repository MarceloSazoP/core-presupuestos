import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, letra, MIN_TOQUE, useTema, type Color } from '@/theme';

// Filtro de estados como pestañas de Material 3 (desplazables): cada estado es un punto de su color, su nombre y cuántos hay, con onda al
// tocar y 48 de alto. Bajo el elegido, la línea indicadora de Material (en el acento) se desliza con un resorte (no salta). Con seis
// estados la fila se desliza de lado; al elegir uno solo se mueve lo justo para que el elegido se vea entero: si ya se ve, no se mueve.
const COLOR: Record<Pestana, Color> = { pendientes: 'aviso', cerrados: 'suave', enviados: 'ok', seguimiento: 'seguimiento', aceptados: 'info', rechazados: 'error' };
const ALTO_INDICADOR = 3;

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
    if (!colocada.current) {
      x.set(m.x);
      ancho.set(m.ancho);
      colocada.current = true;
      return;
    }
    const resorte = { damping: 26, stiffness: 340, mass: 0.8, reduceMotion: ReduceMotion.System };
    x.set(withSpring(m.x, resorte));
    ancho.set(withSpring(m.ancho, resorte));
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
            const color = t[COLOR[p.id]];
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
                  <View style={[e.punto, { backgroundColor: color, opacity: elegida || cuentas[p.id] > 0 ? 1 : 0.35 }]} />
                  <Text variant="titleSmall" style={{ color: elegida ? t.acento : t.suave }}>{p.texto}</Text>
                  <View style={[e.cuenta, { backgroundColor: elegida ? `${t.acento}26` : `${t.suave}1F` }]}>
                    <Text variant="labelSmall" style={[e.numero, { color: elegida ? t.acento : t.suave }]}>{cuentas[p.id]}</Text>
                  </View>
                </View>
              </TouchableRipple>
            );
          })}
          {/* La línea indicadora de Material: va bajo la pestaña elegida, con las esquinas de arriba redondeadas. */}
          <Animated.View pointerEvents="none" style={[e.indicador, { backgroundColor: t.acento }, indicador]} />
        </View>
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  contenedor: { borderBottomWidth: StyleSheet.hairlineWidth },
  barra: { paddingHorizontal: espacio.xs },
  fila: { flexDirection: 'row' },
  pestana: { minHeight: MIN_TOQUE, justifyContent: 'center', paddingHorizontal: espacio.l },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  cuenta: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  numero: { fontSize: letra.chico - 2, fontVariant: ['tabular-nums'] },
  indicador: { position: 'absolute', bottom: 0, left: 0, height: ALTO_INDICADOR, borderTopLeftRadius: ALTO_INDICADOR, borderTopRightRadius: ALTO_INDICADOR },
});
