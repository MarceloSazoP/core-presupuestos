import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { Arrastre } from '@/components/arrastre';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, letra, useTema, type Color } from '@/theme';

// Filtro de estados: una fila liviana. Cada estado es un punto de su color, su nombre y cuántos hay; el elegido se rellena con un
// tinte de su color. Antes eran cinco bloques de color llenos y la pantalla se veía como un tablero de semáforos: ahora el color
// solo aparece donde dice algo (el punto) y en lo elegido. Con cinco estados se desliza de lado; al elegir uno la fila solo se
// mueve lo justo para que el elegido se vea entero: si ya se ve, no se mueve (antes empujaba «Pendientes» fuera de la pantalla).
const COLOR: Record<Pestana, Color> = { pendientes: 'aviso', enviados: 'ok', seguimiento: 'seguimiento', aceptados: 'acento', rechazados: 'error' };

// Mientras se arrastra un presupuesto (`arrastre`), las pestañas a las que puede ir se iluminan al pasar el dedo encima y las demás se apagan.
function Resalte({ arrastre, indice, color }: { arrastre: Arrastre; indice: number; color: string }) {
  const t = useTema();
  const encima = useAnimatedStyle(() => ({ opacity: withTiming(arrastre.hover.get() === indice ? 1 : 0, { duration: 120 }) }));
  const apagada = useAnimatedStyle(() => ({ opacity: withTiming(arrastre.activo.get() === 1 && !arrastre.validas.get()[indice] ? 0.7 : 0, { duration: 120 }) }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[e.resalte, { backgroundColor: `${color}40`, borderColor: color }, encima]} />
      <Animated.View pointerEvents="none" style={[e.resalte, { backgroundColor: t.fondo }, apagada]} />
    </>
  );
}

export function Pestanas({ activa, cuentas, alElegir, arrastre }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void; arrastre?: Arrastre }) {
  const t = useTema();
  const barra = useRef<ScrollView>(null);
  const medidas = useRef<Partial<Record<Pestana, { x: number; ancho: number }>>>({});
  const desplazado = useRef(0); // cuánto se ha deslizado la fila
  const visible = useRef(0); // ancho de la fila en pantalla
  const cont = useRef<View>(null);
  const contenido = useRef(0); // ancho de todo lo que hay en la fila
  const quien = arrastre?.quien ?? null;

  // Al empezar a arrastrar se mide dónde está la fila en la ventana; con eso y la posición de cada pestaña dentro de ella se sabe
  // sobre cuál se suelta. Y si el dedo se acerca a una orilla de la fila, esta se desliza sola para llegar a las pestañas ocultas.
  useEffect(() => {
    if (!quien || !arrastre) return;
    let vivo = true;
    arrastre.scroll.set(desplazado.current);
    let banda = { y: 0, h: 0 };
    const ancho = Dimensions.get('window').width;
    const maximo = () => Math.max(0, contenido.current - visible.current);
    cont.current?.measureInWindow((bx, by, _bw, bh) => {
      if (!vivo) return;
      banda = { y: by, h: bh };
      arrastre.rects.set(PESTANAS.map((p) => { const m = medidas.current[p.id]; return m ? { x: m.x + bx, y: by, w: m.ancho, h: bh } : { x: -1000, y: -1000, w: 0, h: 0 }; }));
    });
    const reloj = setInterval(() => {
      const dedoX = arrastre.x.get();
      const dedoY = arrastre.y.get();
      if (dedoY < banda.y - 90 || dedoY > banda.y + banda.h + 90) return; // solo cerca de la fila
      const zona = 64;
      const paso = dedoX < zona ? -Math.ceil(((zona - dedoX) / zona) * 14) : dedoX > ancho - zona ? Math.ceil(((dedoX - (ancho - zona)) / zona) * 14) : 0;
      if (paso) barra.current?.scrollTo({ x: Math.min(maximo(), Math.max(0, desplazado.current + paso)), animated: false });
    }, 16);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [quien, arrastre]);

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
    <View ref={cont} accessibilityRole="tablist">
      <ScrollView
        ref={barra}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={e.barra}
        scrollEventThrottle={16}
        onContentSizeChange={(w) => (contenido.current = w)}
        onScroll={(ev) => {
          desplazado.current = ev.nativeEvent.contentOffset.x;
          arrastre?.scroll.set(desplazado.current);
        }}
        onLayout={(ev) => {
          visible.current = ev.nativeEvent.layout.width;
          mostrar(activa, false);
        }}
      >
        {PESTANAS.map((p, i) => {
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
              {arrastre ? <Resalte arrastre={arrastre} indice={i} color={color} /> : null}
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
  resalte: { ...StyleSheet.absoluteFill, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  texto: { fontSize: letra.cuerpo - 1 },
  cuenta: { fontSize: letra.chico, fontWeight: '600', fontVariant: ['tabular-nums'], opacity: 0.75 },
});
