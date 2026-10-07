import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type ScrollViewProps } from 'react-native';
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

// Mientras flota, la barra es un panel propio, a todo el ancho y de otro color que la página (la superficie de nivel 2: blanco en claro,
// un tono más claro en oscuro), con las esquinas de arriba redondeadas, una sombra hacia arriba y, en oscuro, un borde claro arriba. Así
// el formulario pasa por debajo sin mezclarse con los botones (los de agregar ítem o tarea ya no se cruzan con Guardar y Terminar). El
// panel baja hasta el borde de la pantalla: tapa también la franja del indicador de inicio, donde antes se veía pasar el contenido.
// Al acercarse a su sitio al final del contenido, el panel se desvanece con el scroll (los últimos 24 puntos) y queda como antes, sobre
// el fondo de la página. Se anima solo la opacidad de esa capa ya sombreada, nunca la sombra (animate-expo).
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
  const estiloPanel = useAnimatedStyle(() => ({ opacity: interpolate(falta(), [0, FUNDIDO], [0, 1], Extrapolation.CLAMP) }));
  // Las capas bajan `margen` más allá de la barra para cubrir la franja de abajo de la pantalla.
  const hastaElBorde = { bottom: -margen };
  return (
    <Animated.View style={[e.barra, estilo]}>
      {/* Debajo, el fondo de la página (como antes): tapa lo que pasa por detrás también mientras el panel aparece o se va. */}
      <View pointerEvents="none" style={[e.capa, hastaElBorde, { backgroundColor: t.fondo }]} />
      <Animated.View pointerEvents="none" style={[e.capa, e.panel, hastaElBorde, { backgroundColor: colors.elevation.level2 }, t.oscuro ? e.panelOscuro : e.panelClaro, estiloPanel]} />
      {children}
    </Animated.View>
  );
}

const e = StyleSheet.create({
  barra: { zIndex: 10, gap: espacio.s, marginHorizontal: -espacio.l, paddingHorizontal: espacio.l, paddingTop: espacio.m, paddingBottom: espacio.s },
  capa: { position: 'absolute', left: 0, right: 0, top: 0 },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  panelClaro: { boxShadow: '0 -4px 16px rgba(16, 24, 40, 0.12)' },
  panelOscuro: { borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(238, 242, 250, 0.16)', boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.6)' },
});
