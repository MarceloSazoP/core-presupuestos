import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { espacio, MIN_TOQUE, useTema } from '@/theme';
import { bordeElevado } from '@/theme-paper';

// Los avisos que piden una decisión («¿Eliminar…?», «¿Terminar…?») como diálogo de Material 3, en lugar del aviso del sistema
// (`Alert.alert`). `decidir` recibe lo mismo que `Alert.alert`: título, mensaje y botones; el diálogo se cierra al tocar un botón y
// después corre su acción, igual que el aviso del sistema.
//
// Cada pantalla dibuja su propio diálogo (`{dialogo}` en su JSX) en vez de uno solo en la raíz: en iOS un Modal se presenta desde la
// pantalla donde está, y uno puesto en la raíz quedaría detrás de las hojas («Nuevo presupuesto», el código, los modales de edición).
export type BotonDialogo = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type Decidir = (titulo: string, mensaje?: string, botones?: BotonDialogo[]) => void;
type Pedido = { titulo: string; mensaje?: string; botones: BotonDialogo[] };

export function useDialogo(): { dialogo: ReactNode; decidir: Decidir } {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [visible, setVisible] = useState(false);
  const accion = useRef<(() => void) | null>(null);

  const decidir = useCallback<Decidir>((titulo, mensaje, botones) => {
    setPedido({ titulo, mensaje, botones: botones?.length ? botones : [{ text: 'Entendido' }] });
    setVisible(true);
  }, []);

  // La acción corre cuando el diálogo ya se cerró: en iOS al terminar de irse (`onDismiss`); en Android se va al instante. Si navega
  // (volver, cerrar la hoja), no choca con el diálogo que se está cerrando.
  const correr = useCallback(() => {
    const f = accion.current;
    accion.current = null;
    f?.();
  }, []);
  const elegir = useCallback((b?: BotonDialogo) => {
    accion.current = b?.onPress ?? null;
    setVisible(false);
    // En iOS la corre `onDismiss`; el plazo es solo un respaldo por si ese aviso no llega (la acción corre una sola vez).
    setTimeout(correr, Platform.OS === 'ios' ? 600 : 0);
  }, [correr]);

  // Tocar fuera o el botón atrás de Android equivale a «Cancelar». Si no hay cancelar y hay un solo botón (un aviso con «Entendido»),
  // equivale a ese botón, para que su acción no se pierda. Con varias opciones y sin cancelar, hay que elegir una.
  const cancelar = pedido?.botones.find((b) => b.style === 'cancel') ?? (pedido?.botones.length === 1 ? pedido.botones[0] : undefined);
  const alSalir = cancelar ? () => elegir(cancelar) : () => {};

  const dialogo = pedido ? (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={alSalir} onDismiss={correr}>
      <DialogoM pedido={pedido} alElegir={elegir} alSalir={alSalir} />
    </Modal>
  ) : null;

  return { dialogo, decidir };
}

function DialogoM({ pedido, alElegir, alSalir }: { pedido: Pedido; alElegir: (b: BotonDialogo) => void; alSalir: () => void }) {
  const t = useTema();
  // Con uno o dos botones van en fila, a la derecha, el de cancelar primero (Material). Con más, uno bajo otro y cancelar al final.
  const enFila = pedido.botones.length <= 2;
  const botones = enFila ? pedido.botones : [...pedido.botones.filter((b) => b.style !== 'cancel'), ...pedido.botones.filter((b) => b.style === 'cancel')];
  return (
    <View style={e.capa}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={alSalir} style={[StyleSheet.absoluteFill, { backgroundColor: t.oscuro ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.32)' }]} />
      <Surface elevation={3} accessibilityViewIsModal style={[e.dialogo, bordeElevado(t)]}>
        <Text variant="headlineSmall" accessibilityRole="header" style={{ color: t.texto }}>{pedido.titulo}</Text>
        {pedido.mensaje ? <Text variant="bodyMedium" style={[e.mensaje, { color: t.suave }]}>{pedido.mensaje}</Text> : null}
        <View style={enFila ? e.fila : e.columna}>
          {botones.map((b) => (
            <Button
              key={b.text}
              mode="text"
              onPress={() => alElegir(b)}
              textColor={b.style === 'destructive' ? t.error : t.acento}
              style={e.boton}
              contentStyle={e.contenidoBoton}
              labelStyle={e.textoBoton}
            >
              {b.text}
            </Button>
          ))}
        </View>
      </Surface>
    </View>
  );
}

const e = StyleSheet.create({
  capa: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  // Medidas del diálogo de Material 3: esquinas de 28, 24 de margen interior, entre 280 y 560 de ancho (aquí hasta 420 en el teléfono).
  dialogo: { width: '100%', minWidth: 280, maxWidth: 420, borderRadius: 28, paddingTop: espacio.xl, paddingHorizontal: espacio.xl, paddingBottom: espacio.l },
  mensaje: { marginTop: espacio.l, fontSize: 15, lineHeight: 22 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espacio.s, marginTop: espacio.xl, marginRight: -espacio.s },
  columna: { alignItems: 'flex-end', gap: 2, marginTop: espacio.xl, marginRight: -espacio.s },
  boton: { borderRadius: 999 },
  contenidoBoton: { minHeight: MIN_TOQUE, paddingHorizontal: espacio.xs },
  textoBoton: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
});
