import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';
import Animated, { Easing, Extrapolation, interpolate, interpolateColor, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Título de la barra que también es un botón entre dos pantallas, para no tener un botón aparte:
// - hacia adelante: «Inicio → Presupuestos» (la pantalla actual y, en un chip, a dónde se va);
// - hacia atrás: «Inicio ← Presupuestos» (el chip, a la izquierda, es la pantalla a la que se vuelve; la actual queda a la derecha).
// Las dos pantallas ocupan siempre el mismo lugar (Inicio a la izquierda, Presupuestos a la derecha); lo que cambia es el papel: la actual
// en el color del texto y el destino en el acento, sobre el chip tonal de Material.
//
// Al pasar de una a otra, junto con la transición de la pantalla (y con su misma duración), se ve que los papeles se intercambian:
// - el título entra deslizándose desde el lado por donde llega la pantalla (de la derecha al avanzar, de la izquierda al volver);
// - el chip viaja de un nombre al otro de forma elástica: su borde de adelante sale primero y el de atrás lo alcanza, así se estira
//   hacia el destino y se recoge al llegar;
// - los dos nombres cambian de color a la vez y la flecha gira de → a ← (o al revés).
// Solo cuando se llega desde la otra pantalla del par; volver desde un presupuesto a la lista no lo repite. Con «reducir movimiento»
// no hay deslizamiento ni giro: el chip aparece en su lugar con un fundido y los colores cambian igual.
type Pantalla = { texto: string; icono: SymbolViewProps['name'] };

// Curvas de animate-expo: movimiento en pantalla (chip, colores, flecha) y entrada (el deslizamiento del título). La duración es la de
// la transición de la pantalla, a la que acompaña.
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const DURACION = 380;
const DESLIZAR = 28; // cuánto se corre el título al entrar
// El título que se mostró por última vez: dice si se llega desde la otra pantalla del par.
let ultimoTitulo: string | null = null;

export function TituloIr({ actual, destino, sentido, alIr }: { actual: Pantalla; destino: Pantalla; sentido: 'adelante' | 'atras'; alIr: () => void }) {
  const t = useTema();
  const { fonts } = useTheme();
  const reducido = useReducedMotion();
  // 0: como se veía en la otra pantalla (el chip sobre la actual); 1: como corresponde aquí (el chip sobre el destino).
  const progreso = useSharedValue(1);
  const entrada = useSharedValue(1); // el deslizamiento del título, con su propia curva de entrada
  // Lugar y ancho de cada pantalla en la fila, medidos al dibujarse; el chip va de uno a otro.
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
      entrada.set(0);
      entrada.set(withTiming(1, { duration: DURACION, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    }, [actual.texto, destino.texto, progreso, entrada]),
  );

  const medir = (x: { set: (v: number) => void }, ancho: { set: (v: number) => void }) => (ev: LayoutChangeEvent) => {
    x.set(ev.nativeEvent.layout.x);
    ancho.set(ev.nativeEvent.layout.width);
  };

  // El chip es una pieza absoluta y sin hijos: se mueve con transform y su ancho cambia sin rehacer el resto de la fila. Cada borde va por
  // su cuenta: el de adelante (hacia donde viaja) recorre el camino en la primera parte del tiempo y el de atrás en la última.
  const estiloChip = useAnimatedStyle(() => {
    const p = progreso.get();
    // Hasta medir las dos pantallas no se muestra (en iOS la barra puede medir el título ya empezada la transición).
    if (actualAncho.get() === 0 || destinoAncho.get() === 0) return { opacity: 0 };
    if (reducido) return { width: destinoAncho.get(), opacity: p, transform: [{ translateX: destinoX.get() }] };
    const haciaLaIzquierda = destinoX.get() < actualX.get();
    const adelante = (desde: number, hasta: number) => interpolate(p, [0, 0.65], [desde, hasta], Extrapolation.CLAMP);
    const atras = (desde: number, hasta: number) => interpolate(p, [0.35, 1], [desde, hasta], Extrapolation.CLAMP);
    const mover = (desde: number, hasta: number, lidera: boolean) => (lidera ? adelante(desde, hasta) : atras(desde, hasta));
    const izquierda = mover(actualX.get(), destinoX.get(), haciaLaIzquierda);
    const derecha = mover(actualX.get() + actualAncho.get(), destinoX.get() + destinoAncho.get(), !haciaLaIzquierda);
    return { width: derecha - izquierda, opacity: 1, transform: [{ translateX: izquierda }] };
  });
  // El título entra desde el lado por donde llega la pantalla: «adelante» es Inicio (se vuelve a ella, llega por la izquierda);
  // «atras» es Presupuestos (se avanza a ella, llega por la derecha).
  const estiloFila = useAnimatedStyle(() => {
    if (reducido) return { transform: [{ translateX: 0 }] };
    const lado = sentido === 'adelante' ? -DESLIZAR : DESLIZAR;
    return { transform: [{ translateX: interpolate(entrada.get(), [0, 1], [lado, 0]) }] };
  });
  // La flecha gira media vuelta: empieza como estaba en la otra pantalla y termina apuntando como corresponde aquí.
  const estiloFlecha = useAnimatedStyle(() => ({ transform: [{ rotate: `${reducido ? 0 : interpolate(progreso.get(), [0, 1], [180, 0])}deg` }] }));
  const colorActual = useAnimatedStyle<TextStyle>(() => ({ color: interpolateColor(progreso.get(), [0, 1], [t.acento, t.texto]) }));
  const colorDestino = useAnimatedStyle<TextStyle>(() => ({ color: interpolateColor(progreso.get(), [0, 1], [t.texto, t.acento]) }));

  const nombre = (p: Pantalla, color: typeof colorActual) => (
    <View style={e.contenido}>
      <SymbolView name={p.icono} size={16} tintColor={t.acento} fallback={<View />} />
      <Animated.Text numberOfLines={1} style={[fonts.titleMedium, e.texto, color]}>{p.texto}</Animated.Text>
    </View>
  );
  const pantallaActual = (
    <View onLayout={medir(actualX, actualAncho)} style={e.parte}>
      {nombre(actual, colorActual)}
    </View>
  );
  const chip = (
    <View onLayout={medir(destinoX, destinoAncho)}>
      <TouchableRipple
        accessibilityRole="button"
        accessibilityLabel={`Ir a ${destino.texto}`}
        hitSlop={8}
        borderless
        onPress={() => {
          void Haptics.selectionAsync();
          alIr();
        }}
        style={e.parte}
      >
        {nombre(destino, colorDestino)}
      </TouchableRipple>
    </View>
  );
  return (
    <Animated.View accessibilityRole="header" accessibilityLabel={actual.texto} style={[e.fila, estiloFila]}>
      <Animated.View pointerEvents="none" style={[e.chip, { backgroundColor: `${t.acento}26` }, estiloChip]} />
      {sentido === 'adelante' ? pantallaActual : chip}
      <Animated.View style={estiloFlecha}>
        <Icono nombre={sentido === 'adelante' ? 'flecha' : 'flechaIzq'} tamano={14} color={t.suave} />
      </Animated.View>
      {sentido === 'adelante' ? chip : pantallaActual}
    </Animated.View>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  // Las dos pantallas con el mismo relleno, así la fila no cambia de ancho cuando el chip pasa de una a otra (chip de Material 3: 32 de
  // alto y esquinas de 8).
  parte: { minHeight: 32, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 10 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texto: { flexShrink: 1 },
  chip: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
});
