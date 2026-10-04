import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, letra, useTema, type Color } from '@/theme';

// Filtro de estados: una fila liviana. Cada estado es un punto de su color, su nombre y cuántos hay; el elegido se rellena con un
// tinte de su color. Antes eran cinco bloques de color llenos y la pantalla se veía como un tablero de semáforos: ahora el color
// solo aparece donde dice algo (el punto) y en lo elegido. Con cinco estados se desliza de lado; al elegir uno la fila solo se
// mueve lo justo para que el elegido se vea entero: si ya se ve, no se mueve (antes empujaba «Pendientes» fuera de la pantalla).
const COLOR: Record<Pestana, Color> = { pendientes: 'aviso', enviados: 'ok', seguimiento: 'seguimiento', aceptados: 'acento', rechazados: 'error' };

export function Pestanas({ activa, cuentas, alElegir }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void }) {
  const t = useTema();
  const barra = useRef<ScrollView>(null);
  const medidas = useRef<Partial<Record<Pestana, { x: number; ancho: number }>>>({});
  const desplazado = useRef(0); // cuánto se ha deslizado la fila
  const visible = useRef(0); // ancho de la fila en pantalla

  // Mueve la fila solo si el estado no se ve entero, y lo justo.
  const mostrar = (id: Pestana, animado: boolean) => {
    const m = medidas.current[id];
    if (!m || !visible.current) return;
    const margen = espacio.m;
    if (m.x - margen < desplazado.current) barra.current?.scrollTo({ x: Math.max(0, m.x - margen), animated: animado });
    else if (m.x + m.ancho + margen > desplazado.current + visible.current) barra.current?.scrollTo({ x: m.x + m.ancho + margen - visible.current, animated: animado });
  };
  useEffect(() => mostrar(activa, true), [activa]);

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
                if (elegida) mostrar(p.id, false);
              }}
              onPress={() => {
                if (!elegida) void Haptics.selectionAsync();
                alElegir(p.id);
              }}
              style={({ pressed }) => [e.chip, elegida && { backgroundColor: `${color}26` }, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[e.punto, { backgroundColor: color, opacity: elegida || cuentas[p.id] > 0 ? 1 : 0.35 }]} />
              <Text style={[e.texto, { color: elegida ? t.texto : t.suave, fontWeight: elegida ? '600' : '500' }]}>{p.texto}</Text>
              <Text style={[e.cuenta, { color: elegida ? t.texto : t.suave }]}>{cuentas[p.id]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  barra: { gap: espacio.xs, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 14 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  texto: { fontSize: letra.cuerpo - 1 },
  cuenta: { fontSize: letra.chico, fontWeight: '600', fontVariant: ['tabular-nums'], opacity: 0.75 },
});
