import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { espacio } from '@/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Las partes de un presupuesto (Visita ↔ Presupuesto…) se cambian deslizando hacia los lados, y el contenido sigue al dedo:
// - Al arrastrar, se mueve con el dedo y se aclara un poco; sin parte al otro lado, se resiste (cuesta un cuarto del recorrido).
// - Al soltar, un empujón rápido o 70 pt cambian de parte: lo actual sale hacia el lado del gesto y la parte nueva entra desde el
//   lado contrario. Si no alcanza, vuelve a su sitio con un resorte suave.
// - Al cambiar con las pestañas de arriba entra igual, desde el lado que corresponde. «Reducir movimiento»: solo un fundido.
export function PartesDeslizables({ posicion, total, alIr, children }: { posicion: number; total: number; alIr: (paso: number) => void; children: ReactNode }) {
  const ancho = useWindowDimensions().width;
  const reducido = useReducedMotion();
  const x = useSharedValue(0);
  const previa = useRef(posicion);
  const salto = ancho * 0.3;

  // La parte nueva entra desde el lado contrario al que se fue (también al tocar las pestañas).
  useEffect(() => {
    if (previa.current === posicion) return;
    const adelante = posicion > previa.current;
    previa.current = posicion;
    x.set(reducido ? 0 : (adelante ? 1 : -1) * salto);
    x.set(withTiming(0, { duration: 280, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
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
      // Sale en 140 ms; al terminar cambia la parte (y el efecto de arriba hace entrar la nueva).
      x.set(withTiming(-paso * salto, { duration: 140, easing: EASE_OUT }, (fin) => {
        if (fin) runOnJS(alIr)(paso);
      }));
    });

  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.get()), [0, salto], [1, 0.2], 'clamp'),
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
