import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Surface, Text, TouchableRipple } from 'react-native-paper';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAvisos } from '@/lib/avisos';
import { sinLeer } from '@/lib/avisos-datos';
import { espacio, MIN_TOQUE, useTema } from '@/theme';
import { bordeElevado } from '@/theme-paper';

// El ☰ de la barra de Inicio, a la derecha: junta los avisos y la configuración en un menú corto de Material 3 (dos opciones) que se abre
// bajo el botón. Si hay avisos sin leer, el ☰ lleva la insignia roja con cuántos, para que no se pierdan aunque la campana ya no esté a
// la vista. Diseño elegido en el lienzo «Menú corto de Inicio» (☰ a la derecha). Igual en iPhone y Android.
//
// El menú va en un Modal transparente (como los diálogos de `dialogo.tsx`): queda sobre la barra nativa en las dos plataformas y se cierra
// al tocar fuera o con «atrás» en Android. Al elegir una opción, el menú se cierra y después se navega: en iOS al terminar de irse
// (`onDismiss`, con un plazo de respaldo); en Android se va al instante.
type Ruta = '/avisos' | '/configurar';
type Lugar = { top: number; right: number };

// Entra desde la esquina del botón: un 5 % más chico y transparente, con la curva de salida fuerte (animate-expo), en 160 ms.
const ENTRADA = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.95 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(0.23, 1, 0.32, 1) },
})
  .duration(160)
  .reduceMotion(ReduceMotion.System);

export function MenuInicio() {
  const t = useTema();
  const sin = sinLeer(useAvisos());
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const boton = useRef<View>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [visible, setVisible] = useState(false);
  const destino = useRef<Ruta | null>(null);

  // El menú se alinea con el borde derecho del botón, justo debajo. Si no se puede medir, queda bajo la barra, a la derecha.
  const abrir = () => {
    const porDefecto = { top: insets.top + 56, right: espacio.s };
    const medido = boton.current;
    if (!medido) {
      setLugar(porDefecto);
      setVisible(true);
      return;
    }
    medido.measureInWindow((x, y, ancho, alto) => {
      setLugar(ancho > 0 ? { top: y + alto + espacio.xs, right: Math.max(espacio.s, width - x - ancho) } : porDefecto);
      setVisible(true);
    });
  };
  const cerrar = () => setVisible(false);
  const navegar = useCallback(() => {
    const ruta = destino.current;
    destino.current = null;
    if (ruta) router.push(ruta);
  }, []);
  const elegir = (ruta: Ruta) => {
    destino.current = ruta;
    setVisible(false);
    // En iOS navega `onDismiss`; el plazo es solo un respaldo por si ese aviso no llega (navega una sola vez).
    setTimeout(navegar, Platform.OS === 'ios' ? 600 : 0);
  };

  return (
    <>
      <Pressable
        ref={boton}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={sin ? `Menú, ${sin} ${sin === 1 ? 'aviso' : 'avisos'} sin leer` : 'Menú'}
        accessibilityState={{ expanded: visible }}
        onPress={abrir}
        hitSlop={8}
        style={[e.boton, visible ? { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1F'}` } : null]}
      >
        <SymbolView name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} size={22} tintColor={t.acento} fallback={<View />} />
        {sin ? (
          <View style={[e.insignia, { backgroundColor: t.error }]}>
            <Text style={e.insigniaTexto}>{sin > 9 ? '9+' : sin}</Text>
          </View>
        ) : null}
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={cerrar} onDismiss={navegar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el menú" onPress={cerrar} style={StyleSheet.absoluteFill} />
        {lugar ? (
          <Animated.View entering={ENTRADA} style={[e.lugar, lugar]}>
            <Surface elevation={2} accessibilityViewIsModal style={[e.menu, bordeElevado(t)]}>
              <Opcion icono={{ ios: 'bell', android: 'notifications', web: 'notifications' }} texto="Avisos" cuenta={sin} alTocar={() => elegir('/avisos')} />
              <Opcion icono={{ ios: 'gearshape', android: 'settings', web: 'settings' }} texto="Configurar" alTocar={() => elegir('/configurar')} />
            </Surface>
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}

// Una opción del menú de Material: 48 de alto, ícono, nombre y, si hay, la cuenta en rojo al final.
function Opcion({ icono, texto, cuenta = 0, alTocar }: { icono: SymbolViewProps['name']; texto: string; cuenta?: number; alTocar: () => void }) {
  const t = useTema();
  return (
    <TouchableRipple
      accessibilityRole="menuitem"
      accessibilityLabel={cuenta ? `${texto}, ${cuenta} sin leer` : texto}
      rippleColor={`${t.texto}1F`}
      onPress={alTocar}
      style={e.opcion}
    >
      <View style={e.fila}>
        <SymbolView name={icono} size={22} tintColor={t.suave} fallback={<View style={e.hueco} />} />
        <Text variant="bodyLarge" numberOfLines={1} style={[e.flex, { color: t.texto }]}>{texto}</Text>
        {cuenta ? (
          <View style={[e.cuenta, { backgroundColor: t.error }]}>
            <Text style={e.cuentaTexto}>{cuenta > 9 ? '9+' : cuenta}</Text>
          </View>
        ) : null}
      </View>
    </TouchableRipple>
  );
}

const e = StyleSheet.create({
  boton: { minHeight: MIN_TOQUE, minWidth: MIN_TOQUE, borderRadius: MIN_TOQUE / 2, alignItems: 'center', justifyContent: 'center' },
  insignia: { position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  // Crece desde la esquina de arriba a la derecha, la del botón.
  lugar: { position: 'absolute', transformOrigin: 'top right' },
  // Menú de Material 3: superficie de nivel 2, entre 200 y 280 de ancho, 8 arriba y abajo.
  menu: { minWidth: 220, maxWidth: 280, borderRadius: 16, paddingVertical: espacio.s },
  opcion: { minHeight: MIN_TOQUE, justifyContent: 'center', paddingLeft: espacio.l, paddingRight: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  flex: { flex: 1 },
  hueco: { width: 22, height: 22 },
  cuenta: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  cuentaTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
