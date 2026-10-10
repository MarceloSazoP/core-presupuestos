import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Badge, Drawer, Text, useTheme } from 'react-native-paper';
import Animated, { Easing, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useAvisos } from '@/lib/avisos';
import { sinLeer } from '@/lib/avisos-datos';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// El menú lateral de la pantalla principal (cajón de navegación modal de Material 3): el ☰ a la izquierda de la barra lo abre de
// izquierda a derecha. Lleva Inicio y Presupuestos (las dos páginas de la pantalla) y, separados, Clientes, Avisos y Configurar. Es un cajón y no
// un menú corto porque irá sumando secciones. Si hay avisos sin leer, el ☰ lleva la insignia roja con cuántos.
//
// Se cierra tocando fuera, deslizándolo hacia la izquierda o con «atrás» en Android. Va en un Modal transparente (como los diálogos):
// queda sobre la barra nativa en iPhone y Android. Al elegir otra pantalla, primero se cierra y después se navega (en iOS al terminar de
// irse el Modal, `onDismiss`, con un plazo de respaldo; en Android al instante).
type Ruta = '/clientes' | '/avisos' | '/configurar';
type Icono = SymbolViewProps['name'];

const ICONOS: Record<'inicio' | 'presupuestos' | 'clientes' | 'avisos' | 'configurar' | 'menu', Icono> = {
  inicio: { ios: 'house', android: 'home', web: 'home' },
  presupuestos: { ios: 'doc.text', android: 'description', web: 'description' },
  clientes: { ios: 'person.2', android: 'group', web: 'group' },
  avisos: { ios: 'bell', android: 'notifications', web: 'notifications' },
  configurar: { ios: 'gearshape', android: 'settings', web: 'settings' },
  menu: { ios: 'line.3.horizontal', android: 'menu', web: 'menu' },
};
// Movimiento (animate-expo): el cajón entra con un resorte sin rebote y sale con la curva de salida fuerte; al soltarlo tras arrastrar,
// sigue con la velocidad del dedo.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTRA = { duration: 320, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const SALE = { duration: 220, easing: EASE_OUT, reduceMotion: ReduceMotion.System };

export function MenuLateral({ pagina, alIrPagina }: { pagina: number; alIrPagina: (p: number) => void }) {
  const t = useTema();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sin = sinLeer(useAvisos());
  const anchoPantalla = useWindowDimensions().width;
  const ancho = Math.min(320, anchoPantalla - 56); // Material: el cajón deja ver 56 de la pantalla a su derecha
  const [montado, setMontado] = useState(false);
  const x = useSharedValue(-ancho); // 0 = abierto; -ancho = cerrado
  const accion = useRef<(() => void) | null>(null);

  const abrir = () => {
    accion.current = null;
    x.set(-ancho);
    setMontado(true);
    x.set(withSpring(0, ENTRA));
  };
  // Lo elegido corre cuando el Modal ya se fue (si navega, no choca con él): en iOS lo avisa `onDismiss`; el plazo es solo un respaldo
  // (corre una sola vez).
  const correr = useCallback(() => {
    const f = accion.current;
    accion.current = null;
    f?.();
  }, []);
  useEffect(() => {
    if (montado) return;
    const plazo = setTimeout(correr, Platform.OS === 'ios' ? 600 : 0);
    return () => clearTimeout(plazo);
  }, [montado, correr]);
  const cerrar = (luego?: () => void) => {
    accion.current = luego ?? null;
    x.set(withTiming(-ancho, SALE, (fin) => {
      if (fin) scheduleOnRN(setMontado, false);
    }));
  };
  const irPagina = (p: number) => {
    if (p !== pagina) alIrPagina(p);
    cerrar();
  };
  const irA = (ruta: Ruta) => cerrar(() => router.push(ruta));

  // Arrastrarlo hacia la izquierda lo acompaña; al soltar, se cierra si se arrastró un tercio o con un empujón rápido.
  const arrastre = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onUpdate((ev) => {
      x.set(Math.min(0, Math.max(-ancho, ev.translationX)));
    })
    .onEnd((ev) => {
      if (ev.translationX + ev.velocityX * 0.15 < -ancho / 3) {
        x.set(withSpring(-ancho, { ...ENTRA, velocity: ev.velocityX }, (fin) => {
          if (fin) scheduleOnRN(setMontado, false);
        }));
      } else {
        x.set(withSpring(0, { ...ENTRA, velocity: ev.velocityX }));
      }
    });

  const estiloCajon = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const estiloVelo = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-ancho, 0], [0, 1]) }));


  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sin ? `Menú, ${sin} ${sin === 1 ? 'aviso' : 'avisos'} sin leer` : 'Menú'}
        accessibilityState={{ expanded: montado }}
        onPress={abrir}
        hitSlop={8}
        style={({ pressed }) => [e.boton, pressed ? { backgroundColor: `${t.acento}1F` } : null]}
      >
        <SymbolView name={ICONOS.menu} size={24} tintColor={t.acento} fallback={<View />} />
        {sin ? (
          <View style={[e.insignia, { backgroundColor: t.error }]}>
            <Text style={e.insigniaTexto}>{sin > 9 ? '9+' : sin}</Text>
          </View>
        ) : null}
      </Pressable>
      <Modal visible={montado} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => cerrar()} onDismiss={correr}>
        <GestureHandlerRootView style={e.flex}>
          {/* El velo de Material sobre la pantalla: se oscurece con el cajón; tocarlo lo cierra. */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }, estiloVelo]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el menú" onPress={() => cerrar()} style={e.flex} />
          </Animated.View>
          <GestureDetector gesture={arrastre}>
            <Animated.View
              accessibilityViewIsModal
              style={[
                e.cajon,
                { width: ancho, backgroundColor: colors.elevation.level1, paddingTop: insets.top + espacio.m, paddingBottom: insets.bottom + espacio.m },
                t.oscuro ? e.bordeOscuro : e.sombraClara,
                estiloCajon,
              ]}
            >
              <View style={e.cabecera}>
                <Image source={t.oscuro ? require('../../assets/images/marca-carga-dark.png') : require('../../assets/images/marca-carga.png')} style={e.logo} contentFit="contain" accessibilityIgnoresInvertColors />
                <Text variant="titleMedium" style={[e.marca, { color: t.texto }]}>CORE Presupuestos</Text>
              </View>
              <Drawer.Section showDivider>
                <Drawer.Item label="Inicio" icon={icono(ICONOS.inicio)} active={pagina === 0} onPress={() => irPagina(0)} />
                <Drawer.Item label="Presupuestos" icon={icono(ICONOS.presupuestos)} active={pagina === 1} onPress={() => irPagina(1)} />
              </Drawer.Section>
              <Drawer.Section showDivider={false}>
                <Drawer.Item label="Clientes" icon={icono(ICONOS.clientes)} onPress={() => irA('/clientes')} />
                <Drawer.Item
                  label="Avisos"
                  icon={icono(ICONOS.avisos)}
                  accessibilityLabel={sin ? `Avisos, ${sin} sin leer` : 'Avisos'}
                  right={() => (sin ? <Badge style={{ backgroundColor: t.error }}>{sin > 99 ? '99+' : sin}</Badge> : null)}
                  onPress={() => irA('/avisos')}
                />
                <Drawer.Item label="Configurar" icon={icono(ICONOS.configurar)} onPress={() => irA('/configurar')} />
              </Drawer.Section>
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

// El ícono de una opción, en el tamaño y color que pide el `Drawer.Item` de Paper (más fuerte en la elegida).
const icono = (nombre: Icono) =>
  function IconoOpcion({ size, color }: { size: number; color: string }) {
    return <SymbolView name={nombre} size={size} tintColor={color} fallback={<View style={{ width: size, height: size }} />} />;
  };

const e = StyleSheet.create({
  flex: { flex: 1 },
  boton: { minHeight: MIN_TOQUE, minWidth: MIN_TOQUE, borderRadius: MIN_TOQUE / 2, alignItems: 'center', justifyContent: 'center' },
  insignia: { position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  // Cajón modal de Material 3: hasta 320 de ancho, la superficie de nivel 1 y las esquinas del lado abierto redondeadas.
  cajon: { position: 'absolute', top: 0, bottom: 0, left: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  sombraClara: { boxShadow: '0 8px 24px rgba(16, 24, 40, 0.18)' },
  bordeOscuro: { borderRightWidth: 1, borderColor: 'rgba(238, 242, 250, 0.16)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.xl + espacio.xs, paddingVertical: espacio.m },
  logo: { width: 36, height: 32 }, // la marca mide 576 × 520
  marca: { fontWeight: '700' },
});
