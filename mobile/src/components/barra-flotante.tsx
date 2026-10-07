import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, type ScrollViewProps } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espacio, useTema } from '@/theme';

// Barra de acciones «flotante» al pie de una pantalla con scroll. Vive al final del contenido (ocupa su lugar y no tapa nada de lo que
// queda del formulario) y, mientras ese final no se ve, se sube a pie de pantalla con una transformación: al llegar al final del
// scroll queda exactamente en su sitio, después del último control. Todo corre en el hilo de la interfaz, sin saltos.
type Medidas = { desplazado: SharedValue<number>; contenido: SharedValue<number>; visible: SharedValue<number> };
const Contexto = createContext<Medidas | null>(null);

// ScrollView que mide cuánto se ha desplazado, cuánto mide el contenido y cuánto se ve.
export function ScrollConBarra({ children, onLayout, onContentSizeChange, ...props }: ScrollViewProps) {
  const desplazado = useSharedValue(0);
  const contenido = useSharedValue(0);
  const visible = useSharedValue(0);
  const alScroll = useAnimatedScrollHandler((ev) => {
    desplazado.set(ev.contentOffset.y);
  });
  return (
    <Contexto.Provider value={{ desplazado, contenido, visible }}>
      <Animated.ScrollView
        {...props}
        onScroll={alScroll}
        scrollEventThrottle={16}
        onLayout={(ev) => {
          visible.set(ev.nativeEvent.layout.height);
          onLayout?.(ev);
        }}
        onContentSizeChange={(w, h) => {
          contenido.set(h);
          onContentSizeChange?.(w, h);
        }}
      >
        {children}
      </Animated.ScrollView>
    </Contexto.Provider>
  );
}

// Mientras flota, los botones van sobre una cápsula elevada (la barra de herramientas flotante de Material 3): separada de los bordes de
// la pantalla, con la superficie de nivel 3, su sombra y, en oscuro, un borde claro. Así se ve que está encima del formulario y no es
// parte de él. Al acercarse a su sitio al final del contenido, la cápsula se desvanece con el scroll (los últimos 24 puntos) y los botones
// quedan integrados a la página. Lo que se anima es la opacidad de esa capa ya sombreada, nunca la sombra ni la elevación (animate-expo).
const FUNDIDO = 24;

// `reserva`: lo que el contenido deja debajo de la barra (su paddingBottom): el final natural de la barra es el del contenido menos eso.
export function BarraFlotante({ reserva, children }: { reserva: number; children: ReactNode }) {
  const t = useTema();
  const { colors } = useTheme();
  const medidas = useContext(Contexto);
  const margen = useSafeAreaInsets().bottom;
  // Cuánto falta para el final natural de la barra: si es positivo, la barra se sube esa distancia para quedar a pie de pantalla.
  const falta = () => {
    'worklet';
    if (!medidas) return 0;
    return medidas.contenido.get() - medidas.desplazado.get() - (medidas.visible.get() - margen) - reserva;
  };
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, falta()) }] }));
  const estiloCapsula = useAnimatedStyle(() => ({ opacity: interpolate(falta(), [0, FUNDIDO], [0, 1], Extrapolation.CLAMP) }));
  return (
    <Animated.View style={[e.barra, estilo]}>
      <Animated.View pointerEvents="none" style={[e.capsula, { backgroundColor: colors.elevation.level3 }, t.oscuro ? e.capsulaOscura : e.capsulaClara, estiloCapsula]} />
      {children}
    </Animated.View>
  );
}

const e = StyleSheet.create({
  barra: { zIndex: 10, gap: espacio.s, marginHorizontal: -espacio.l, paddingHorizontal: espacio.l, paddingTop: espacio.m, paddingBottom: espacio.s },
  // Con 8 de aire alrededor de los botones (52 de alto), la cápsula mide 68 y su radio de 34 la deja redonda en los extremos, concéntrica
  // con los botones de píldora.
  capsula: { position: 'absolute', left: espacio.s, right: espacio.s, top: espacio.xs, bottom: 0, borderRadius: 34 },
  capsulaClara: { boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16), 0 2px 4px rgba(16, 24, 40, 0.08)' },
  capsulaOscura: { borderWidth: 1, borderColor: 'rgba(238, 242, 250, 0.16)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)' },
});
