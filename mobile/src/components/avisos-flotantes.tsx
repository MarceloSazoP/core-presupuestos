import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeInUp, FadeOutUp, LinearTransition, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icono, Texto, type NombreIcono } from '@/components/ui';
import { cerrarToast, useToasts, type Toast, type TipoToast } from '@/lib/toast';
import { espacio, radio, useTema, type Color } from '@/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Entra desde arriba en 280 ms y sale un poco más rápido (receta de toast de animate-expo, espejada para el borde superior).
const ENTRA = FadeInUp.duration(280).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const SALE = FadeOutUp.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const FICHA: Record<TipoToast, { icono: NombreIcono; color: Color; ms: number }> = {
  error: { icono: 'error', color: 'error', ms: 6000 },
  aviso: { icono: 'alerta', color: 'aviso', ms: 5500 },
  exito: { icono: 'exito', color: 'ok', ms: 4000 },
  info: { icono: 'info', color: 'acento', ms: 4500 },
};

// Capa fija sobre toda la app, bajo la barra de estado. No bloquea lo de abajo: solo las tarjetas reciben toques.
export function AvisosFlotantes() {
  const insets = useSafeAreaInsets();
  const toasts = useToasts();
  return (
    <View pointerEvents="box-none" style={[e.capa, { top: insets.top + espacio.s }]}>
      {toasts.map((x) => (
        <Tarjeta key={x.id} toast={x} />
      ))}
    </View>
  );
}

function Tarjeta({ toast }: { toast: Toast }) {
  const t = useTema();
  const { icono, color, ms } = FICHA[toast.tipo];
  const tono = t[color];
  const y = useSharedValue(0);

  useEffect(() => {
    void Haptics.notificationAsync(toast.tipo === 'error' ? Haptics.NotificationFeedbackType.Error : toast.tipo === 'exito' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const h = setTimeout(() => cerrarToast(toast.id), ms);
    return () => clearTimeout(h);
  }, [toast.id, toast.tipo, ms]);

  // Se cierra con un toque o deslizándolo hacia arriba (basta un empujón rápido, no hace falta recorrer toda la distancia).
  const cerrar = () => cerrarToast(toast.id);
  const gesto = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((ev) => {
      y.set(Math.min(0, ev.translationY));
    })
    .onEnd((ev) => {
      if (ev.translationY + ev.velocityY * 0.2 < -40) {
        y.set(withTiming(-200, { duration: 180 }, () => runOnJS(cerrar)()));
      } else y.set(withTiming(0, { duration: 180, easing: EASE_OUT }));
    });
  const arrastre = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View entering={ENTRA} exiting={SALE} layout={LinearTransition.duration(200)} style={arrastre}>
        <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={`${toast.titulo}.${toast.texto ? ` ${toast.texto}` : ''}`} onTouchEnd={cerrar} style={[e.tarjeta, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
          <View style={[e.icono, { backgroundColor: `${tono}22` }]}>
            <Icono nombre={icono} tamano={22} color={tono} />
          </View>
          <View style={e.textos}>
            <Texto fuerte>{toast.titulo}</Texto>
            {toast.texto ? <Texto variante="chico" suave>{toast.texto}</Texto> : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const e = StyleSheet.create({
  capa: { position: 'absolute', left: espacio.l, right: espacio.l, gap: espacio.s, zIndex: 100 },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', padding: espacio.m, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  icono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
});
