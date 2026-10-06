import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { espacio } from '@/theme';

// Las partes de un presupuesto (Visita ↔ Presupuesto…) se cambian como las páginas de iPhone: el contenido sigue al dedo, sin
// atenuarse, y al soltar sale entero hacia un lado mientras la parte nueva entra desde el otro y se asienta con un resorte.
// Un empujón rápido o 70 pt cambian de parte; si no alcanza, vuelve a su sitio. Sin parte al otro lado, resiste (un cuarto del
// recorrido). Con las pestañas de arriba entra igual. «Reducir movimiento»: cambia sin deslizar.
export function PartesDeslizables({ posicion, total, alIr, children }: { posicion: number; total: number; alIr: (paso: number) => void; children: ReactNode }) {
  const ancho = useWindowDimensions().width;
  const reducido = useReducedMotion();
  const x = useSharedValue(0);
  const previa = useRef(posicion);
  const salto = ancho; // la página entra y sale entera, como en iPhone

  // La parte nueva entra desde el lado contrario al que se fue (también al tocar las pestañas).
  useEffect(() => {
    if (previa.current === posicion) return;
    const adelante = posicion > previa.current;
    previa.current = posicion;
    x.set(reducido ? 0 : (adelante ? 1 : -1) * salto);
    x.set(withSpring(0, { damping: 30, stiffness: 320, mass: 0.9, reduceMotion: ReduceMotion.System })); // se asienta sin rebote notorio
  }, [posicion, reducido, salto, x]);

  const gesto = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onUpdate((ev) => {
      const hayDestino = (ev.translationX < 0 && posicion < total - 1) || (ev.translationX > 0 && posicion > 0);
      x.set(hayDestino ? ev.translationX : ev.translationX * 0.25);
    })
    .onEnd((ev) => {
      const proyectado = ev.translationX + ev.velocityX * 0.15;
      const paso = proyectado < -70 ? 1 : proyectado > 70 ? -1 : 0;
      const hayDestino = paso !== 0 && posicion + paso >= 0 && posicion + paso < total;
      if (!hayDestino) {
        x.set(withSpring(0, { damping: 24, stiffness: 260, reduceMotion: ReduceMotion.System }));
        return;
      }
      // Sale entero (más rápido si el gesto fue rápido); al terminar cambia la parte (y el efecto de arriba hace entrar la nueva).
      x.set(withTiming(-paso * salto, { duration: Math.max(120, Math.min(220, 260 - Math.abs(ev.velocityX) / 8)), easing: Easing.bezier(0.3, 0, 0.8, 0.6) }, (fin) => {
        if (fin) runOnJS(alIr)(paso);
      }));
    });

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={[e.partes, estilo]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const e = StyleSheet.create({
  partes: { gap: espacio.l },
});
