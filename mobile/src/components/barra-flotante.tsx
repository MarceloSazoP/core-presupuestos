import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, type ScrollViewProps } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
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

// `reserva`: lo que el contenido deja debajo de la barra (su paddingBottom): el final natural de la barra es el del contenido menos eso.
export function BarraFlotante({ reserva, children }: { reserva: number; children: ReactNode }) {
  const t = useTema();
  const medidas = useContext(Contexto);
  const margen = useSafeAreaInsets().bottom;
  const estilo = useAnimatedStyle(() => {
    if (!medidas) return {};
    // Cuánto falta para el final natural de la barra: si es positivo, la barra se sube esa distancia para quedar a pie de pantalla.
    const falta = medidas.contenido.get() - medidas.desplazado.get() - (medidas.visible.get() - margen) - reserva;
    return { transform: [{ translateY: -Math.max(0, falta) }] };
  });
  return (
    <Animated.View style={[e.barra, { backgroundColor: t.fondo, borderColor: t.borde }, estilo]}>
      {children}
    </Animated.View>
  );
}

const e = StyleSheet.create({
  barra: { zIndex: 10, gap: espacio.s, marginHorizontal: -espacio.l, paddingHorizontal: espacio.l, paddingTop: espacio.m, paddingBottom: espacio.s, borderTopWidth: StyleSheet.hairlineWidth },
});
