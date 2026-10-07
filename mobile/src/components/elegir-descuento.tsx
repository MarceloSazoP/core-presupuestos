import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { Icono } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';
import { bordeElevado } from '@/theme-paper';

// El descuento se elige girando una rueda desde abajo (0 % a 100 %), como la unidad y como la fecha en Ajustes de iPhone.
const OPCIONES = Array.from({ length: 101 }, (_, i) => i);
const texto = (p: number | null, respaldo: string) => (p === null ? respaldo : p === 0 ? 'Sin descuento' : `${p} %`);

export function ElegirDescuento({ valor, respaldo, alElegir }: { valor: number | null; respaldo: string; alElegir: (p: number) => void }) {
  const t = useTema();
  const { colors } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [rueda, setRueda] = useState(valor ?? 0);
  return (
    <>
      {/* Con el contorno de un campo de Material, sobre la superficie donde está, y la onda al tocar. */}
      <TouchableRipple
        accessibilityRole="button"
        accessibilityLabel={`Descuento: ${texto(valor, respaldo)}. Cambiar`}
        onPress={() => {
          setRueda(valor ?? 0);
          setAbierto(true);
        }}
        borderless
        style={[e.campo, { borderColor: t.bordeCampo }]}
      >
        <View style={e.fila}>
          <Text variant="bodyLarge" style={e.fuerte}>{texto(valor, respaldo)}</Text>
          <Icono nombre="despliegue" tamano={18} color={t.acento} />
        </View>
      </TouchableRipple>
      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable accessibilityLabel="Cerrar sin cambiar" style={e.fondo} onPress={() => setAbierto(false)} />
        {/* Hoja inferior de Material: esquinas de 28, la superficie elevada y la barra con botones de texto. */}
        <View style={[e.hoja, { backgroundColor: colors.elevation.level1 }, bordeElevado(t)]}>
          <View style={e.barra}>
            <Button mode="text" onPress={() => setAbierto(false)} textColor={t.acento} style={e.boton} contentStyle={e.contenidoBoton} labelStyle={e.textoBoton}>
              Cancelar
            </Button>
            <Text variant="titleMedium" accessibilityRole="header">Descuento</Text>
            <Button mode="text" onPress={() => { alElegir(rueda); setAbierto(false); }} textColor={t.acento} accessibilityLabel="Listo" style={e.boton} contentStyle={e.contenidoBoton} labelStyle={[e.textoBoton, e.fuerte]}>
              Listo
            </Button>
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
  campo: { minHeight: 52, borderWidth: 1, borderRadius: radio.s, justifyContent: 'center', paddingHorizontal: espacio.l },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  fuerte: { fontWeight: '600' },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: espacio.s, paddingBottom: espacio.xl },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.s },
  boton: { borderRadius: 999, minWidth: 96 },
  contenidoBoton: { minHeight: MIN_TOQUE },
  textoBoton: { fontSize: 16, lineHeight: 20 },
  rueda: { height: 216 },
});
