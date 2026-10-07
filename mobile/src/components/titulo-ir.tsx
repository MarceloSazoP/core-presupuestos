import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';
import Animated, { Easing, Extrapolation, interpolate, interpolateColor, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Título de la barra de Inicio y de Presupuestos: un selector de Material 3 (botones segmentados) [Inicio | Presupuestos]. La sección
// actual va marcada con el tono suave del acento y un ✓; tocar la otra lleva a ella. Inicio siempre a la izquierda y Presupuestos a la
// derecha: `sentido` «adelante» es la pantalla de Inicio (la actual a la izquierda), «atras» la de Presupuestos (la actual a la derecha).
// Diseño elegido en el lienzo «Rediseño lista de Presupuestos» (opción B), en lugar de «Inicio ← Presupuestos». Igual en iPhone y Android.
//
// Al pasar de una a otra, junto con la transición de la pantalla, el resaltado viaja de un segmento al otro de forma elástica (el borde de
// adelante sale primero y el de atrás lo alcanza) y los dos nombres cambian de color. Solo al llegar desde la otra sección: volver de un
// presupuesto a la lista no lo repite. Con «reducir movimiento» el resaltado no viaja: aparece en su lugar con un fundido.
type Pantalla = { texto: string; icono: SymbolViewProps['name'] };

// Curva de movimiento en pantalla (animate-expo); dura lo que la transición de la pantalla, a la que acompaña.
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const DURACION = 380;
// La sección que se mostró por última vez: dice si se llega desde la otra.
let ultimoTitulo: string | null = null;

export function TituloIr({ actual, destino, sentido, alIr }: { actual: Pantalla; destino: Pantalla; sentido: 'adelante' | 'atras'; alIr: () => void }) {
  const t = useTema();
  const { fonts } = useTheme();
  const reducido = useReducedMotion();
  // 0: como se veía en la otra sección (el resaltado sobre el destino); 1: como corresponde aquí (sobre la actual).
  const progreso = useSharedValue(1);
  const actualX = useSharedValue(0);
  const actualAncho = useSharedValue(0);
  const destinoX = useSharedValue(0);
  const destinoAncho = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      const desdeElOtro = ultimoTitulo === destino.texto;
      ultimoTitulo = actual.texto;
      if (!desdeElOtro) return;
      progreso.set(0);
      progreso.set(withTiming(1, { duration: DURACION, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.Never }));
    }, [actual.texto, destino.texto, progreso]),
  );

  const medir = (x: { set: (v: number) => void }, ancho: { set: (v: number) => void }) => (ev: LayoutChangeEvent) => {
    x.set(ev.nativeEvent.layout.x);
    ancho.set(ev.nativeEvent.layout.width);
  };

  // El resaltado es una pieza absoluta y sin hijos: se mueve con transform y su ancho cambia sin rehacer el resto. Cada borde va por su
  // cuenta: el de adelante (hacia donde viaja) recorre el camino en la primera parte del tiempo y el de atrás en la última.
  const estiloResaltado = useAnimatedStyle(() => {
    const p = progreso.get();
    if (actualAncho.get() === 0 || destinoAncho.get() === 0) return { opacity: 0 };
    if (reducido) return { width: actualAncho.get(), opacity: p, transform: [{ translateX: actualX.get() }] };
    const haciaLaIzquierda = actualX.get() < destinoX.get();
    const adelante = (desde: number, hasta: number) => interpolate(p, [0, 0.65], [desde, hasta], Extrapolation.CLAMP);
    const atras = (desde: number, hasta: number) => interpolate(p, [0.35, 1], [desde, hasta], Extrapolation.CLAMP);
    const mover = (desde: number, hasta: number, lidera: boolean) => (lidera ? adelante(desde, hasta) : atras(desde, hasta));
    const izquierda = mover(destinoX.get(), actualX.get(), haciaLaIzquierda);
    const derecha = mover(destinoX.get() + destinoAncho.get(), actualX.get() + actualAncho.get(), !haciaLaIzquierda);
    return { width: derecha - izquierda, opacity: 1, transform: [{ translateX: izquierda }] };
  });
  const colorActual = useAnimatedStyle<TextStyle>(() => ({ color: interpolateColor(progreso.get(), [0, 1], [t.texto, t.acento]) }));
  const colorDestino = useAnimatedStyle<TextStyle>(() => ({ color: interpolateColor(progreso.get(), [0, 1], [t.acento, t.texto]) }));

  const segmentoActual = (
    <View accessible accessibilityRole="tab" accessibilityState={{ selected: true }} accessibilityLabel={actual.texto} onLayout={medir(actualX, actualAncho)} style={e.segmento}>
      <Icono nombre="listo" tamano={16} color={t.acento} />
      <Animated.Text numberOfLines={1} style={[fonts.labelLarge, e.texto, colorActual]}>{actual.texto}</Animated.Text>
    </View>
  );
  const segmentoDestino = (
    <View onLayout={medir(destinoX, destinoAncho)}>
      <TouchableRipple
        accessibilityRole="tab"
        accessibilityState={{ selected: false }}
        accessibilityLabel={`Ir a ${destino.texto}`}
        onPress={() => {
          void Haptics.selectionAsync();
          alIr();
        }}
        style={e.segmento}
      >
        <View style={e.contenido}>
          <SymbolView name={destino.icono} size={16} tintColor={t.texto} fallback={<View />} />
          <Animated.Text numberOfLines={1} style={[fonts.labelLarge, e.texto, colorDestino]}>{destino.texto}</Animated.Text>
        </View>
      </TouchableRipple>
    </View>
  );
  const linea = <View style={[e.linea, { backgroundColor: t.bordeCampo }]} />;
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Sección" style={[e.selector, { borderColor: t.bordeCampo }]}>
      <Animated.View pointerEvents="none" style={[e.resaltado, { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1F'}` }, estiloResaltado]} />
      {sentido === 'adelante' ? segmentoActual : segmentoDestino}
      {linea}
      {sentido === 'adelante' ? segmentoDestino : segmentoActual}
    </View>
  );
}

const e = StyleSheet.create({
  // Botones segmentados de Material 3: 40 de alto, borde de contorno y esquinas redondas.
  selector: { flexDirection: 'row', alignItems: 'stretch', height: 40, borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  segmento: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: espacio.l, minHeight: 38 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texto: { fontWeight: '600' },
  linea: { width: 1 },
  resaltado: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
