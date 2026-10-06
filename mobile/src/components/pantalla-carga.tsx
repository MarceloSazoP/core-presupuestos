import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { espacio, useTema } from '@/theme';

// La pantalla de carga mientras la app arranca (lee la sesión y el tema guardados): el nombre, «CORE» en azul y «Presupuestos» en dorado, y un
// indicador con «Iniciando…» para que se note que la app está arrancando. Es el mismo logotipo de la imagen de inicio nativa
// (assets/images/splash-wordmark*.png), así que el paso de una a otra no se nota. En oscuro, tonos más claros para que se lean.
const COLORES = {
  claro: { core: '#0E3578', presupuestos: '#B8860B' }, // azul de la marca y dorado (3,2:1 sobre el gris claro: es un título grande)
  oscuro: { core: '#8FB4FF', presupuestos: '#F2C14E' },
};

export function PantallaCarga() {
  const t = useTema();
  const c = t.oscuro ? COLORES.oscuro : COLORES.claro;
  // El texto «Iniciando…» respira despacio (opacidad, 1,2 s); con «reducir movimiento» queda fijo.
  const pulso = useSharedValue(1);
  useEffect(() => {
    pulso.set(withRepeat(withSequence(withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1, false, undefined, ReduceMotion.System));
  }, [pulso]);
  const respira = useAnimatedStyle(() => ({ opacity: pulso.get() }));

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Iniciando CORE Presupuestos" style={[e.pantalla, { backgroundColor: t.fondo }]}>
      <Text style={e.nombre} adjustsFontSizeToFit numberOfLines={1}>
        <Text style={{ color: c.core }}>CORE </Text>
        <Text style={{ color: c.presupuestos }}>Presupuestos</Text>
      </Text>
      <View style={e.cargando}>
        <ActivityIndicator size="small" color={c.presupuestos} />
        <Animated.Text style={[e.texto, { color: t.suave }, respira]}>Iniciando…</Animated.Text>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espacio.xl, gap: espacio.xl },
  nombre: { fontSize: 38, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' },
  cargando: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  texto: { fontSize: 15, fontWeight: '500' },
});
