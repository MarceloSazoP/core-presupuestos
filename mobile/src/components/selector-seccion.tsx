import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// El título de la barra fija de la pantalla principal: un selector de Material 3 (botones segmentados) [Inicio | Presupuestos]. La sección
// que se ve va marcada con el tono suave del acento y un ✓; tocar la otra pasa a ella. Diseño elegido en el lienzo «Barra fija y Nuevo
// presupuesto». Igual en iPhone y Android.
//
// `progreso` es la misma posición que mueve las páginas (0 = Inicio, 1 = Presupuestos), así que todo va junto: mientras el contenido se
// desliza, el resaltado viaja de un segmento al otro de forma elástica (el borde de adelante sale primero y el de atrás lo alcanza), los
// nombres cambian de color y el ✓ pasa de uno a otro con un fundido. Con «reducir movimiento» la posición cambia de golpe y esto también.
type Seccion = { texto: string; icono: SymbolViewProps['name'] };
const SECCIONES: readonly [Seccion, Seccion] = [
  { texto: 'Inicio', icono: { ios: 'house.fill', android: 'home', web: 'home' } },
  { texto: 'Presupuestos', icono: { ios: 'doc.text.fill', android: 'description', web: 'description' } },
];

export function SelectorSeccion({ progreso, pagina, alElegir }: { progreso: SharedValue<number>; pagina: number; alElegir: (p: number) => void }) {
  const t = useTema();
  const x0 = useSharedValue(0);
  const ancho0 = useSharedValue(0);
  const x1 = useSharedValue(0);
  const ancho1 = useSharedValue(0);

  // El resaltado es una pieza absoluta y sin hijos: se mueve con transform y su ancho cambia sin rehacer el resto. De Inicio a Presupuestos
  // el borde derecho va adelante (recorre su camino en los primeros 2/3) y el izquierdo lo alcanza al final; de vuelta, al revés.
  const estiloResaltado = useAnimatedStyle(() => {
    if (ancho0.get() === 0 || ancho1.get() === 0) return { opacity: 0 };
    const p = progreso.get();
    const derecha = interpolate(p, [0, 0.65], [x0.get() + ancho0.get(), x1.get() + ancho1.get()], Extrapolation.CLAMP);
    const izquierda = interpolate(p, [0.35, 1], [x0.get(), x1.get()], Extrapolation.CLAMP);
    return { opacity: 1, width: derecha - izquierda, transform: [{ translateX: izquierda }] };
  });

  return (
    <View accessibilityRole="tablist" accessibilityLabel="Sección" style={[e.selector, { borderColor: t.bordeCampo }]}>
      <Animated.View pointerEvents="none" style={[e.resaltado, { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1F'}` }, estiloResaltado]} />
      <Segmento indice={0} progreso={progreso} elegido={pagina === 0} alElegir={alElegir} x={x0} ancho={ancho0} />
      <View style={[e.linea, { backgroundColor: t.bordeCampo }]} />
      <Segmento indice={1} progreso={progreso} elegido={pagina === 1} alElegir={alElegir} x={x1} ancho={ancho1} />
    </View>
  );
}

// Un segmento: el ✓ y el ícono de la sección comparten lugar y se cruzan con la posición; el nombre pasa del color del texto al acento.
function Segmento({ indice, progreso, elegido, alElegir, x, ancho }: { indice: 0 | 1; progreso: SharedValue<number>; elegido: boolean; alElegir: (p: number) => void; x: SharedValue<number>; ancho: SharedValue<number> }) {
  const t = useTema();
  const { fonts } = useTheme();
  const seccion = SECCIONES[indice];
  // Cuánto es esta la sección que se ve: 1 si se ve, 0 si se ve la otra.
  const cuanto = (p: number) => {
    'worklet';
    return indice === 0 ? 1 - p : p;
  };
  const estiloTexto = useAnimatedStyle<TextStyle>(() => ({ color: interpolateColor(cuanto(progreso.get()), [0, 1], [t.texto, t.acento]) }));
  const estiloListo = useAnimatedStyle(() => ({ opacity: cuanto(progreso.get()) }));
  const estiloIcono = useAnimatedStyle(() => ({ opacity: 1 - cuanto(progreso.get()) }));
  const medir = (ev: LayoutChangeEvent) => {
    x.set(ev.nativeEvent.layout.x);
    ancho.set(ev.nativeEvent.layout.width);
  };
  return (
    <View onLayout={medir}>
      <TouchableRipple
        accessibilityRole="tab"
        accessibilityState={{ selected: elegido }}
        accessibilityLabel={elegido ? seccion.texto : `Ir a ${seccion.texto}`}
        rippleColor={`${t.acento}29`}
        onPress={() => {
          if (elegido) return;
          void Haptics.selectionAsync();
          alElegir(indice);
        }}
        style={e.segmento}
      >
        <View style={e.contenido}>
          <View style={e.iconos}>
            <Animated.View style={[e.capa, estiloListo]}>
              <Icono nombre="listo" tamano={16} color={t.acento} />
            </Animated.View>
            <Animated.View style={[e.capa, estiloIcono]}>
              <SymbolView name={seccion.icono} size={16} tintColor={t.texto} fallback={<View />} />
            </Animated.View>
          </View>
          <Animated.Text numberOfLines={1} style={[fonts.labelLarge, e.texto, estiloTexto]}>{seccion.texto}</Animated.Text>
        </View>
      </TouchableRipple>
    </View>
  );
}

const e = StyleSheet.create({
  // Botones segmentados de Material 3: 40 de alto, borde de contorno y esquinas redondas.
  selector: { flexDirection: 'row', alignItems: 'stretch', height: 40, borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  segmento: { justifyContent: 'center', paddingHorizontal: espacio.l, minHeight: 38 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconos: { width: 16, height: 16 },
  capa: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  texto: { fontWeight: '600' },
  linea: { width: 1 },
  resaltado: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
