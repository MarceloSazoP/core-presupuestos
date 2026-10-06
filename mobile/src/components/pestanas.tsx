import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, letra, radio, useTema, type Color } from '@/theme';

// Filtro de estados: una pista baja (34 pt) con borde fino y, debajo del estado elegido, una pastilla del color de ese estado que se
// desliza con un resorte (no salta). Cada estado es un punto de su color, su nombre y cuántos hay; el color solo aparece donde dice
// algo (el punto) y en lo elegido. Con cinco estados la pista se desliza de lado; al elegir uno solo se mueve lo justo para que el
// elegido se vea entero: si ya se ve, no se mueve.
const COLOR: Record<Pestana, Color> = { pendientes: 'aviso', enviados: 'ok', seguimiento: 'seguimiento', aceptados: 'acento', rechazados: 'error' };
const PAD = 3;

export function Pestanas({ activa, cuentas, alElegir }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void }) {
  const t = useTema();
  const barra = useRef<ScrollView>(null);
  const medidas = useRef<Partial<Record<Pestana, { x: number; ancho: number }>>>({});
  const desplazado = useRef(0); // cuánto se ha deslizado la fila
  const visible = useRef(0); // ancho de la fila en pantalla
  const x = useSharedValue(0);
  const ancho = useSharedValue(0);
  const colocada = useRef(false); // la pastilla se coloca sin animar la primera vez

  // Mueve la fila solo si el estado no se ve entero, y lo justo.
  const mostrar = (id: Pestana, animado: boolean) => {
    const m = medidas.current[id];
    if (!m || !visible.current) return;
    const margen = espacio.m;
    if (m.x - margen < desplazado.current) barra.current?.scrollTo({ x: Math.max(0, m.x - margen), animated: animado });
    else if (m.x + m.ancho + margen > desplazado.current + visible.current) barra.current?.scrollTo({ x: m.x + m.ancho + margen - visible.current, animated: animado });
  };

  // La pastilla va a donde está el estado elegido (con resorte); la primera vez, directo.
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

  const pastilla = useAnimatedStyle(() => ({ width: ancho.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View accessibilityRole="tablist">
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
        <View style={[e.pista, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
          <Animated.View pointerEvents="none" style={[e.pastilla, { backgroundColor: `${t[COLOR[activa]]}26` }, pastilla]} />
          {PESTANAS.map((p) => {
            const elegida = p.id === activa;
            const color = t[COLOR[p.id]];
            return (
              <Pressable
                key={p.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: elegida }}
                accessibilityLabel={`${p.texto}, ${cuentas[p.id]}`}
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
                style={({ pressed }) => [e.chip, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[e.punto, { backgroundColor: color, opacity: elegida || cuentas[p.id] > 0 ? 1 : 0.35 }]} />
                <Text style={[e.texto, { color: elegida ? t.texto : t.suave, fontWeight: elegida ? '600' : '500' }]}>{p.texto}</Text>
                <Text style={[e.cuenta, { color: elegida ? t.texto : t.suave }]}>{cuentas[p.id]}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  barra: { paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  pista: { flexDirection: 'row', padding: PAD, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous' },
  pastilla: { position: 'absolute', top: PAD, bottom: PAD, left: 0, borderRadius: radio.m, borderCurve: 'continuous' },
  chip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  texto: { fontSize: letra.chico + 1 },
  cuenta: { fontSize: letra.chico, fontWeight: '600', fontVariant: ['tabular-nums'], opacity: 0.75 },
});
