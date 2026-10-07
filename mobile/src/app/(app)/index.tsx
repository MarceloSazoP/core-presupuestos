import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formaPanel } from '@/components/barra-flotante';
import { BotonM } from '@/components/material';
import { MenuInicio } from '@/components/menu-inicio';
import { PaginaInicio } from '@/components/pagina-inicio';
import { PaginaPresupuestos } from '@/components/pagina-presupuestos';
import { SelectorSeccion } from '@/components/selector-seccion';
import { espacio, useTema } from '@/theme';

// La pantalla principal: Inicio y Presupuestos son dos páginas de la misma pantalla, lado a lado, bajo una sola barra fija (el selector
// [Inicio | Presupuestos] y el ☰) y sobre un solo panel con «Nuevo presupuesto». Al pasar de una a otra solo se desliza el contenido; la
// barra y el panel no se mueven, y el resaltado del selector viaja con la misma posición que las páginas. Diseño elegido en el lienzo
// «Barra fija y Nuevo presupuesto». Igual en iPhone y Android.
//
// Se pasa de página deslizando (desde Inicio hacia la izquierda; desde la primera pestaña de Presupuestos hacia la derecha) o tocando el
// selector. En Android, «atrás» en Presupuestos vuelve a Inicio. `?pagina=presupuestos` abre directo en Presupuestos.
const ALTO_BOTON = 52; // el botón principal de Material
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1); // movimiento en pantalla (animate-expo)

export default function Principal() {
  const t = useTema();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ancho = useWindowDimensions().width;
  const { pagina: pedida } = useLocalSearchParams<{ pagina?: string }>();
  const [pagina, setPagina] = useState(pedida === 'presupuestos' ? 1 : 0);
  const progreso = useSharedValue(pagina); // 0 = Inicio, 1 = Presupuestos; mueve las páginas y el selector

  // Tras deslizar, la página sigue con un resorte sin rebote (el dedo ya la empujó); al tocar el selector, con la curva de movimiento en
  // pantalla. Con «reducir movimiento», cambia de golpe.
  const ir = useCallback(
    (destino: number, conGesto = false) => {
      setPagina(destino);
      progreso.set(
        conGesto
          ? withSpring(destino, { duration: 380, dampingRatio: 1, reduceMotion: ReduceMotion.System })
          : withTiming(destino, { duration: 380, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System }),
      );
    },
    [progreso],
  );

  useFocusEffect(
    useCallback(() => {
      if (pagina === 0) return;
      const s = BackHandler.addEventListener('hardwareBackPress', () => {
        ir(0);
        return true;
      });
      return () => s.remove();
    }, [pagina, ir]),
  );

  const estiloPaginas = useAnimatedStyle(() => ({ transform: [{ translateX: -progreso.get() * ancho }] }));
  const abajo = insets.bottom + ALTO_BOTON + espacio.m * 2; // lo que tapa el panel de abajo

  return (
    <View style={[e.pantalla, { backgroundColor: t.fondo }]}>
      <Stack.Screen
        options={{
          headerTitleAlign: 'center',
          headerTitle: () => <SelectorSeccion progreso={progreso} pagina={pagina} alElegir={(p) => ir(p)} />,
          headerRight: () => <MenuInicio />,
        }}
      />
      <Animated.View style={[e.paginas, { width: ancho * 2 }, estiloPaginas]}>
        {/* La página que no se ve queda fuera de la pantalla y oculta para el lector de pantalla. */}
        <View style={{ width: ancho }} accessibilityElementsHidden={pagina !== 0} importantForAccessibility={pagina === 0 ? 'auto' : 'no-hide-descendants'}>
          <PaginaInicio activa={pagina === 0} alPresupuestos={() => ir(1, true)} abajo={abajo} />
        </View>
        <View style={{ width: ancho }} accessibilityElementsHidden={pagina !== 1} importantForAccessibility={pagina === 1 ? 'auto' : 'no-hide-descendants'}>
          <PaginaPresupuestos alInicio={() => ir(0, true)} abajo={abajo} />
        </View>
      </Animated.View>
      {/* Acción principal en la zona del pulgar, en un panel propio como la barra del presupuesto: la superficie de nivel 2 con la sombra
          hacia arriba, hasta el borde de la pantalla. Las dos páginas pasan por debajo sin mezclarse con el botón. */}
      <View style={[e.panel, formaPanel(t.oscuro), { backgroundColor: colors.elevation.level2, paddingBottom: insets.bottom + espacio.m }]}>
        <BotonM titulo="Nuevo presupuesto" icono="mas" onPress={() => router.push('/nuevo')} />
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, overflow: 'hidden' },
  paginas: { flex: 1, flexDirection: 'row' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: espacio.m, paddingHorizontal: espacio.l },
});
