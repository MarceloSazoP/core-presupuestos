import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icono, Texto } from '@/components/ui';
import { simboloUnidad, textoUnidad, UNIDADES } from '@/lib/unidades';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// La unidad se elige girando una rueda que sube desde abajo, como la de la fecha en Ajustes de iPhone: en iPhone es la rueda nativa
// (gira con inercia y suena un «clic» por cada unidad). Cancelar la descarta; «Listo» la aplica.
export function ElegirUnidad({ valor, alElegir }: { valor: string; alElegir: (codigo: string) => void }) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [rueda, setRueda] = useState(valor);
  const abrir = () => {
    setRueda(valor);
    setAbierto(true);
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Unidad: ${simboloUnidad(valor)}. Cambiar`} onPress={abrir} style={({ pressed }) => [e.fila, { backgroundColor: t.campo, borderColor: t.bordeCampo, opacity: pressed ? 0.7 : 1 }]}>
        <Texto fuerte>{textoUnidad(UNIDADES.find((u) => u.codigo === valor) ?? { simbolo: valor, nombre: valor })}</Texto>
        <Icono nombre="despliegue" tamano={18} color={t.acento} />
      </Pressable>
      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable accessibilityLabel="Cerrar sin cambiar" style={e.fondo} onPress={() => setAbierto(false)} />
        <View style={[e.hoja, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
          <View style={e.barra}>
            <Pressable accessibilityRole="button" onPress={() => setAbierto(false)} hitSlop={8} style={e.lado}>
              <Texto color="acento">Cancelar</Texto>
            </Pressable>
            <Texto fuerte accessibilityRole="header">Unidad</Texto>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={() => { alElegir(rueda); setAbierto(false); }} hitSlop={8} style={[e.lado, e.derecha]}>
              <Texto color="acento" fuerte>Listo</Texto>
            </Pressable>
          </View>
          <Picker selectedValue={rueda} onValueChange={(v) => setRueda(String(v))} itemStyle={{ color: t.texto, fontSize: 20 }} style={e.rueda}>
            {UNIDADES.map((u) => (
              <Picker.Item key={u.codigo} label={textoUnidad(u)} value={u.codigo} color={t.texto} />
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
