import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icono, Texto } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// El descuento se elige girando una rueda desde abajo (0 % a 100 %), como la unidad y como la fecha en Ajustes de iPhone.
const OPCIONES = Array.from({ length: 101 }, (_, i) => i);
const texto = (p: number | null, respaldo: string) => (p === null ? respaldo : p === 0 ? 'Sin descuento' : `${p} %`);

export function ElegirDescuento({ valor, respaldo, alElegir }: { valor: number | null; respaldo: string; alElegir: (p: number) => void }) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [rueda, setRueda] = useState(valor ?? 0);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Descuento: ${texto(valor, respaldo)}. Cambiar`}
        onPress={() => {
          setRueda(valor ?? 0);
          setAbierto(true);
        }}
        style={({ pressed }) => [e.fila, { backgroundColor: t.campo, borderColor: t.bordeCampo, opacity: pressed ? 0.7 : 1 }]}
      >
        <Texto fuerte>{texto(valor, respaldo)}</Texto>
        <Icono nombre="despliegue" tamano={18} color={t.acento} />
      </Pressable>
      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable accessibilityLabel="Cerrar sin cambiar" style={e.fondo} onPress={() => setAbierto(false)} />
        <View style={[e.hoja, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
          <View style={e.barra}>
            <Pressable accessibilityRole="button" onPress={() => setAbierto(false)} hitSlop={8} style={e.lado}>
              <Texto color="acento">Cancelar</Texto>
            </Pressable>
            <Texto fuerte accessibilityRole="header">Descuento</Texto>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={() => { alElegir(rueda); setAbierto(false); }} hitSlop={8} style={[e.lado, e.derecha]}>
              <Texto color="acento" fuerte>Listo</Texto>
            </Pressable>
          </View>
          <Picker selectedValue={rueda} onValueChange={(v) => setRueda(Number(v))} itemStyle={{ color: t.texto, fontSize: 22 }} style={e.rueda}>
            {OPCIONES.map((p) => (
              <Picker.Item key={p} label={texto(p, '')} value={p} color={t.texto} />
            ))}
          </Picker>
        </View>
      </Modal>
    </>
  );
}

const e = StyleSheet.create({
  fila: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.l },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: { borderTopLeftRadius: radio.l, borderTopRightRadius: radio.l, borderWidth: StyleSheet.hairlineWidth, paddingBottom: espacio.xl },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  derecha: { alignItems: 'flex-end' },
  rueda: { height: 216 },
});
