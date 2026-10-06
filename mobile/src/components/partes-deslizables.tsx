import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { marcarDeslizado } from '@/lib/deslizado';
import { espacio } from '@/theme';

// Las partes de un presupuesto (Visita ↔ Presupuesto…) se cambian deslizando hacia los lados, con un movimiento corto para no marear:
// - Al arrastrar, el contenido acompaña al dedo a media velocidad y con tope (poco recorrido). Sin parte al otro lado, resiste.
// - Al soltar, un empujón rápido o 70 pt cambian de parte al instante, y la parte nueva se asienta desde un costado con un resorte
//   corto (nada sale de la pantalla ni vuelve a aparecer del otro lado).
// - Al tocar las pestañas de arriba entra igual. «Reducir movimiento»: cambia sin deslizar.
// `alBorde`: se llama con -1 o 1 si el deslizado va hacia donde no hay más partes (p. ej. de la primera pestaña hacia atrás: volver a Inicio).
// `alFuerte`: un deslizado potente (largo o muy rápido) llama a esto en vez de cambiar a la parte vecina (p. ej. volver a Inicio de una).
const FUERTE = 260; // pt (distancia + empuje) para que un deslizado cuente como «potente»
const RESORTE = { damping: 28, stiffness: 380, mass: 0.8, reduceMotion: ReduceMotion.System }; // se asienta sin rebote notorio

export function PartesDeslizables({ posicion, total, alIr, alBorde, alFuerte, estilo: estiloExtra, children }: { posicion: number; total: number; alIr: (paso: number) => void; alBorde?: (paso: number) => void; alFuerte?: (paso: number) => void; estilo?: StyleProp<ViewStyle>; children: ReactNode }) {
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
    x.set(withSpring(0, RESORTE)); // se asienta sin rebote notorio
  }, [posicion, reducido, salto, x]);

  const gesto = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onStart(() => marcarDeslizado())
    .onUpdate((ev) => {
      const hayDestino = (ev.translationX < 0 && posicion < total - 1) || (ev.translationX > 0 && posicion > 0);
      const mover = hayDestino ? ev.translationX * 0.5 : ev.translationX * 0.12;
      x.set(Math.max(-tope, Math.min(tope, mover)));
    })
    .onEnd((ev) => {
      const proyectado = ev.translationX + ev.velocityX * 0.15;
      const paso = proyectado < -70 ? 1 : proyectado > 70 ? -1 : 0;
      if (alFuerte && Math.abs(proyectado) > FUERTE) {
        marcarDeslizado();
        x.set(withSpring(0, RESORTE));
        alFuerte(paso);
        return;
      }
      const hayDestino = paso !== 0 && posicion + paso >= 0 && posicion + paso < total;
      marcarDeslizado();
      if (!hayDestino) {
        x.set(withSpring(0, { damping: 24, stiffness: 260, reduceMotion: ReduceMotion.System }));
        if (paso !== 0) alBorde?.(paso);
        return;
      }
      alIr(paso); // cambia al instante; el efecto de arriba asienta la parte nueva desde el costado
    });

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={[e.partes, estiloExtra, estilo]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const e = StyleSheet.create({
  partes: { gap: espacio.l },
});
