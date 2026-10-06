import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { espacio } from '@/theme';

// Las partes de un presupuesto (Visita ↔ Presupuesto…) se cambian deslizando hacia los lados, con un movimiento corto para no marear:
// - Al arrastrar, el contenido acompaña al dedo a media velocidad y con tope (poco recorrido). Sin parte al otro lado, resiste.
// - Al soltar, un empujón rápido o 70 pt cambian de parte al instante, y la parte nueva se asienta desde un costado con un resorte
//   corto (nada sale de la pantalla ni vuelve a aparecer del otro lado).
// - Al tocar las pestañas de arriba entra igual. «Reducir movimiento»: cambia sin deslizar.
export function PartesDeslizables({ posicion, total, alIr, children }: { posicion: number; total: number; alIr: (paso: number) => void; children: ReactNode }) {
  const ancho = useWindowDimensions().width;
  const reducido = useReducedMotion();
  const x = useSharedValue(0);
  const previa = useRef(posicion);
  const salto = ancho * 0.14; // recorrido corto de entrada (unos 55 pt en un iPhone)
  const tope = ancho * 0.22; // lo más que acompaña al dedo

  // La parte nueva entra desde el lado contrario al que se fue (también al tocar las pestañas).
  useEffect(() => {
    if (previa.current === posicion) return;
    const adelante = posicion > previa.current;
    previa.current = posicion;
    x.set(reducido ? 0 : (adelante ? 1 : -1) * salto);
    x.set(withSpring(0, { damping: 28, stiffness: 380, mass: 0.8, reduceMotion: ReduceMotion.System })); // se asienta sin rebote notorio
  }, [posicion, reducido, salto, x]);

  const gesto = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onUpdate((ev) => {
      const hayDestino = (ev.translationX < 0 && posicion < total - 1) || (ev.translationX > 0 && posicion > 0);
      const mover = hayDestino ? ev.translationX * 0.5 : ev.translationX * 0.12;
      x.set(Math.max(-tope, Math.min(tope, mover)));
    })
    .onEnd((ev) => {
      const proyectado = ev.translationX + ev.velocityX * 0.15;
      const paso = proyectado < -70 ? 1 : proyectado > 70 ? -1 : 0;
      const hayDestino = paso !== 0 && posicion + paso >= 0 && posicion + paso < total;
      if (!hayDestino) {
        x.set(withSpring(0, { damping: 24, stiffness: 260, reduceMotion: ReduceMotion.System }));
        return;
      }
      alIr(paso); // cambia al instante; el efecto de arriba asienta la parte nueva desde el costado
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
