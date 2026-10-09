import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuLateral } from '@/components/menu-lateral';
import { PaginaInicio } from '@/components/pagina-inicio';
import { PaginaPresupuestos } from '@/components/pagina-presupuestos';
import { TituloConIcono } from '@/components/titulo-con-icono';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// La pantalla principal: Inicio y Presupuestos son dos páginas de la misma pantalla, lado a lado, bajo una sola barra fija (el ☰ del menú
// lateral a la izquierda y el nombre de la sección) y con un solo botón redondo de «Nuevo presupuesto» abajo a la derecha. Al pasar de una
// a otra solo se desliza el contenido; la barra y el botón no se mueven. Igual en iPhone y Android.
//
// Se pasa de página desde el menú lateral o deslizando (desde Inicio hacia la izquierda; desde la primera pestaña de Presupuestos hacia la
// derecha). En Android, «atrás» en Presupuestos vuelve a Inicio. `?pagina=presupuestos` abre directo en Presupuestos.
const BOTON = 64; // el botón redondo de «Nuevo presupuesto»
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1); // movimiento en pantalla (animate-expo)

export default function Principal() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const ancho = useWindowDimensions().width;
  const { pagina: pedida } = useLocalSearchParams<{ pagina?: string }>();
  const [pagina, setPagina] = useState(pedida === 'presupuestos' ? 1 : 0);
  const progreso = useSharedValue(pagina); // 0 = Inicio, 1 = Presupuestos; mueve las páginas

  // Tras deslizar, la página sigue con un resorte sin rebote (el dedo ya la empujó); al elegirla en el menú, con la curva de movimiento en
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
  const abajo = insets.bottom + espacio.l + BOTON; // lo que tapa el botón de abajo: el contenido puede terminar sobre él

  return (
    <View style={[e.pantalla, { backgroundColor: t.fondo }]}>
      <Stack.Screen
        options={{
          title: pagina === 0 ? 'Inicio' : 'Presupuestos',
          headerLeft: () => <MenuLateral pagina={pagina} alIrPagina={(p) => ir(p)} />,
          headerTitle: () =>
            pagina === 0 ? (
              <TituloConIcono texto="Inicio" icono={{ ios: 'house.fill', android: 'home', web: 'home' }} />
            ) : (
              <TituloConIcono texto="Presupuestos" icono={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} />
            ),
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
      {/* Acción principal: el botón flotante de Material, redondo, abajo a la derecha (en la zona del pulgar). Lleva el + y el ícono del
          documento, como «+ Ítem» en el presupuesto. Tapa solo una esquina; al final del contenido queda espacio para que nada quede debajo. */}
      <View style={[e.flotante, t.oscuro ? e.sombraOscura : e.sombraClara, { backgroundColor: t.acento, bottom: insets.bottom + espacio.l }]}>
        <TouchableRipple accessibilityRole="button" accessibilityLabel="Nuevo presupuesto" rippleColor={`${t.sobreAcento}40`} onPress={() => router.push('/nuevo')} style={e.toque}>
          <View style={e.contenidoBoton}>
            <Text style={[e.mas, { color: t.sobreAcento }]}>+</Text>
            <Icono nombre="documento" tamano={24} color={t.sobreAcento} />
          </View>
        </TouchableRipple>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, overflow: 'hidden' },
  paginas: { flex: 1, flexDirection: 'row' },
  flotante: { position: 'absolute', right: espacio.l, width: BOTON, height: BOTON, borderRadius: BOTON / 2 },
  // La elevación del botón flotante de Material (nivel 3); en oscuro, más honda para que se vea sobre el fondo.
  sombraClara: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.30), 0 4px 8px 3px rgba(0, 0, 0, 0.15)' },
  sombraOscura: { boxShadow: '0 4px 14px rgba(0, 0, 0, 0.65)' },
  toque: { flex: 1, borderRadius: BOTON / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  contenidoBoton: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  mas: { fontSize: 22, lineHeight: 26, fontWeight: '700' },
});
