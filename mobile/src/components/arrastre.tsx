import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { ResumenPresupuesto } from '@/api/types';
import { Texto } from '@/components/ui';
import { estadosPosibles, type EstadoElegible } from '@/lib/estados';
import { clp } from '@/lib/formato';
import { ESTADO_DE_PESTANA, PESTANAS } from '@/lib/pestanas';
import { espacio, radio, useTema } from '@/theme';

// Arrastrar un presupuesto ya enviado a una pestaña de estado para cambiárselo. Es un atajo: el botón de estado de la tarjeta
// (hoja «Pasar a») sigue funcionando igual. Se empieza manteniendo apretada la tarjeta; al soltar sobre una pestaña válida cambia
// de estado, y en cualquier otro lugar no pasa nada. Solo se mueven los presupuestos que pueden cambiar de estado (los pendientes
// no) y solo hacia los estados distintos del actual.
export type Rect = { x: number; y: number; w: number; h: number };
export type Arrastre = {
  quien: ResumenPresupuesto | null; // el que se está arrastrando
  activo: SharedValue<number>; // 1 mientras se arrastra
  x: SharedValue<number>; // posición del dedo en la ventana
  y: SharedValue<number>;
  hover: SharedValue<number>; // índice de la pestaña bajo el dedo, o -1
  rects: SharedValue<Rect[]>; // dónde está cada pestaña en la ventana cuando la fila está sin desplazar (se mide al empezar)
  scroll: SharedValue<number>; // cuánto se ha deslizado la fila de pestañas: la posición real es la de `rects` menos esto
  validas: SharedValue<boolean[]>; // a qué pestañas puede ir el que se arrastra
  empezar: (q: ResumenPresupuesto) => void;
  soltar: (indice: number) => void;
};

export function useArrastre(alSoltar: (q: ResumenPresupuesto, estado: EstadoElegible) => void): Arrastre {
  const [quien, setQuien] = useState<ResumenPresupuesto | null>(null);
  const actual = useRef<ResumenPresupuesto | null>(null);
  const activo = useSharedValue(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const hover = useSharedValue(-1);
  const rects = useSharedValue<Rect[]>([]);
  const scroll = useSharedValue(0);
  const validas = useSharedValue<boolean[]>(PESTANAS.map(() => false));

  const empezar = useCallback(
    (q: ResumenPresupuesto) => {
      actual.current = q;
      const posibles = new Set(estadosPosibles(q).map((s) => s.id));
      validas.set(PESTANAS.map((p) => { const e = ESTADO_DE_PESTANA[p.id]; return !!e && posibles.has(e); }));
      hover.set(-1);
      activo.set(1);
      setQuien(q);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // «lo tomaste»
    },
    [activo, hover, validas],
  );

  const soltar = useCallback(
    (indice: number) => {
      const q = actual.current;
      if (!q) return; // un toque normal también termina el gesto: no hay nada que soltar
      actual.current = null;
      activo.set(0);
      hover.set(-1);
      validas.set(PESTANAS.map(() => false));
      setQuien(null);
      const estado = indice >= 0 ? ESTADO_DE_PESTANA[PESTANAS[indice]!.id] : undefined;
      if (estado) alSoltar(q, estado);
    },
    [activo, alSoltar, hover, validas],
  );

  return { quien, activo, x, y, hover, rects, scroll, validas, empezar, soltar };
}

// Envuelve la tarjeta: el gesto empieza tras 350 ms apretada (antes, el toque y el desplazado de la lista siguen normales).
export function Arrastrable({ q, arrastre, children }: { q: ResumenPresupuesto; arrastre: Arrastre; children: ReactNode }) {
  const { x, y, hover, rects, scroll, validas, empezar, soltar } = arrastre;
  const gesto = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(350)
        .onStart((e) => {
          x.set(e.absoluteX);
          y.set(e.absoluteY);
          scheduleOnRN(empezar, q);
        })
        .onUpdate((e) => {
          x.set(e.absoluteX);
          y.set(e.absoluteY);
          const lista = rects.get();
          const ok = validas.get();
          const dx = scroll.get(); // la fila de pestañas se desliza sola al acercar el dedo a una orilla
          let h = -1;
          for (let i = 0; i < lista.length; i++) {
            const r = lista[i];
            if (r && ok[i] && e.absoluteX >= r.x - dx - 6 && e.absoluteX <= r.x - dx + r.w + 6 && e.absoluteY >= r.y - 12 && e.absoluteY <= r.y + r.h + 12) {
              h = i;
              break;
            }
          }
          if (h !== hover.get()) hover.set(h);
        })
        .onFinalize((_e, exito) => {
          scheduleOnRN(soltar, exito ? hover.get() : -1);
        }),
    [empezar, hover, q, rects, scroll, soltar, validas, x, y],
  );
  return (
    <GestureDetector gesture={gesto}>
      <View style={arrastre.quien?.id === q.id ? e.origen : null}>{children}</View>
    </GestureDetector>
  );
}

const ANCHO = 250;
const ALTO = 64;

// La tarjeta que sigue al dedo. `origen`: dónde empieza la pantalla en la ventana (las coordenadas del dedo son de la ventana).
export function Fantasma({ arrastre, origen }: { arrastre: Arrastre; origen: SharedValue<{ x: number; y: number }> }) {
  const t = useTema();
  const { quien, x, y } = arrastre;
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() - origen.get().x - ANCHO / 2 }, { translateY: y.get() - origen.get().y - ALTO / 2 }, { scale: 1.03 }],
  }));
  if (!quien) return null;
  return (
    <Animated.View entering={FadeIn.duration(120)} pointerEvents="none" style={[e.fantasma, { backgroundColor: t.tarjeta, borderColor: t.acento }, estilo]}>
      <Texto fuerte numberOfLines={1}>{quien.customer.name}</Texto>
      <Texto variante="chico" suave>{quien.total > 0 ? clp(quien.total) : 'Presupuesto'}</Texto>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  origen: { opacity: 0.35 }, // el lugar del que se levantó queda atenuado
  fantasma: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ANCHO,
    height: ALTO,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: espacio.l,
    borderWidth: 2,
    borderRadius: radio.l,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
