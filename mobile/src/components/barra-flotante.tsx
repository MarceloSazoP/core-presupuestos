import * as Haptics from 'expo-haptics';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ScrollViewProps } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Barra de acciones «flotante» al pie de una pantalla con scroll. Vive al final del contenido (ocupa su lugar y no tapa nada de lo que
// queda del formulario) y, mientras ese final no se ve, se sube a pie de pantalla con una transformación: al llegar al final del
// scroll queda exactamente en su sitio, después del último control. Todo corre en el hilo de la interfaz, sin saltos.
type Medidas = { desplazado: SharedValue<number>; contenido: SharedValue<number>; visible: SharedValue<number>; alFinal: () => void };
const Contexto = createContext<Medidas | null>(null);

// ScrollView que mide cuánto se ha desplazado, cuánto mide el contenido y cuánto se ve, y sabe bajar hasta el final.
export function ScrollConBarra({ children, onLayout, onContentSizeChange, ...props }: ScrollViewProps) {
  const desplazado = useSharedValue(0);
  const contenido = useSharedValue(0);
  const visible = useSharedValue(0);
  const ref = useAnimatedRef<Animated.ScrollView>();
  const alScroll = useAnimatedScrollHandler((ev) => {
    desplazado.set(ev.contentOffset.y);
  });
  const alFinal = () => ref.current?.scrollToEnd({ animated: true });
  return (
    <Contexto.Provider value={{ desplazado, contenido, visible, alFinal }}>
      <Animated.ScrollView
        ref={ref}
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

// Mientras flota, la barra es un panel propio, a todo el ancho y de otro color que la página (la superficie de nivel 2: blanco en claro,
// un tono más claro en oscuro), con las esquinas de arriba redondeadas, una sombra hacia arriba y, en oscuro, un borde claro arriba. Así
// el formulario pasa por debajo sin mezclarse con los botones. El panel baja hasta el borde de la pantalla: tapa también la franja del
// indicador de inicio. Al acercarse a su sitio al final del contenido, el panel se desvanece con el scroll (los últimos 24 puntos) y queda
// sobre el fondo de la página. Se anima solo la opacidad de esa capa ya sombreada, nunca la sombra (animate-expo).
//
// `pista`: lo que queda debajo y la barra tapa (en el presupuesto, «Condiciones»). Mientras está escondido, sobre el panel aparece un chip
// «↓ Condiciones» que baja hasta el final; se va cuando eso ya se ve. Así se nota que la pantalla sigue y se llega con un toque.
const FUNDIDO = 24;
// Desde cuánto falta para el final se muestra la pista (lo que queda tapado mide más que esto) y en cuánto aparece del todo.
const PISTA_DESDE = 120;
const PISTA_FUNDIDO = 48;
// Franja arriba de la barra donde va la pista. Es parte de la barra (en Android, un toque fuera de los límites de su padre no llega) y,
// cuando la barra queda en su sitio, es el aire entre lo último del formulario y los botones.
const ZONA_PISTA = 32 + espacio.s;

// `reserva`: lo que el contenido deja debajo de la barra (su paddingBottom): el final natural de la barra es el del contenido menos eso.
export function BarraFlotante({ reserva, pista, children }: { reserva: number; pista?: string; children: ReactNode }) {
  const t = useTema();
  const { colors } = useTheme();
  const medidas = useContext(Contexto);
  const margen = useSafeAreaInsets().bottom;
  const [conPista, setConPista] = useState(false);
  // Cuánto falta para el final natural de la barra: si es positivo, la barra se sube esa distancia para quedar a pie de pantalla.
  const falta = useDerivedValue(() => (medidas ? medidas.contenido.get() - medidas.desplazado.get() - (medidas.visible.get() - margen) - reserva : 0));
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, falta.get()) }] }));
  const estiloPanel = useAnimatedStyle(() => ({ opacity: interpolate(falta.get(), [0, FUNDIDO], [0, 1], Extrapolation.CLAMP) }));
  const estiloPista = useAnimatedStyle(() => ({ opacity: interpolate(falta.get(), [PISTA_DESDE, PISTA_DESDE + PISTA_FUNDIDO], [0, 1], Extrapolation.CLAMP) }));
  // La pista solo recibe toques mientras se ve: se avisa a React una vez, al cruzar el umbral (no en cada cuadro).
  useAnimatedReaction(
    () => !!pista && falta.get() > PISTA_DESDE + PISTA_FUNDIDO / 2,
    (ahora, antes) => {
      if (ahora !== antes) scheduleOnRN(setConPista, ahora);
    },
  );
  // Las capas bajan `margen` más allá de la barra para cubrir la franja de abajo de la pantalla.
  const hastaElBorde = { bottom: -margen };
  return (
    // `box-none`: la franja de la pista, vacía, deja pasar los toques al formulario de abajo.
    <Animated.View pointerEvents="box-none" style={[e.barra, estilo]}>
      {/* Debajo, el fondo de la página (como antes): tapa lo que pasa por detrás también mientras el panel aparece o se va, y recibe los
          toques que caen entre los botones para que no lleguen al formulario. */}
      <View style={[e.capa, hastaElBorde, { backgroundColor: t.fondo }]} />
      <Animated.View pointerEvents="none" style={[e.capa, e.panel, hastaElBorde, { backgroundColor: colors.elevation.level2 }, t.oscuro ? e.panelOscuro : e.panelClaro, estiloPanel]} />
      {pista ? (
        <Animated.View pointerEvents={conPista ? 'box-none' : 'none'} style={[e.zonaPista, estiloPista]}>
          <TouchableRipple
            accessibilityRole="button"
            accessibilityLabel={`Ir a ${pista}, más abajo`}
            accessibilityElementsHidden={!conPista}
            importantForAccessibility={conPista ? 'auto' : 'no-hide-descendants'}
            hitSlop={8}
            borderless
            onPress={() => {
              void Haptics.selectionAsync();
              medidas?.alFinal();
            }}
            style={[e.pista, { backgroundColor: colors.elevation.level2 }, t.oscuro ? e.panelOscuro : e.pistaClara]}
          >
            <View style={e.filaPista}>
              <Icono nombre="despliegue" tamano={16} color={t.acento} />
              <Text variant="labelLarge" style={{ color: t.acento }}>{pista}</Text>
            </View>
          </TouchableRipple>
        </Animated.View>
      ) : null}
      {children}
    </Animated.View>
  );
}

// La forma del panel (esquinas de arriba redondeadas, sombra hacia arriba y, en oscuro, el borde claro), para otro panel de abajo que no
// flota: el de «Nuevo presupuesto» en la lista. El color va aparte: la superficie de nivel 2.
export const formaPanel = (oscuro: boolean) => [e.panel, oscuro ? e.panelOscuro : e.panelClaro];

const e = StyleSheet.create({
  barra: { zIndex: 10, gap: espacio.s, marginHorizontal: -espacio.l, paddingHorizontal: espacio.l, paddingTop: ZONA_PISTA + espacio.m, paddingBottom: espacio.s },
  capa: { position: 'absolute', left: 0, right: 0, top: ZONA_PISTA },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  panelClaro: { boxShadow: '0 -4px 16px rgba(16, 24, 40, 0.12)' },
  panelOscuro: { borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(238, 242, 250, 0.16)', boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.6)' },
  // El chip de la pista, centrado sobre el panel (chip de Material: 32 de alto; el toque se agranda con hitSlop).
  zonaPista: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  pista: { minHeight: 32, borderRadius: 16, justifyContent: 'center', paddingHorizontal: espacio.m },
  pistaClara: { boxShadow: '0 2px 8px rgba(16, 24, 40, 0.16)' },
  filaPista: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
