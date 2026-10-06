import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icono, Texto } from '@/components/ui';
import { GRUPOS_UNIDAD, simboloUnidad, textoUnidad, UNIDADES } from '@/lib/unidades';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// La unidad se elige girando dos ruedas que suben desde abajo, como la de la fecha en Ajustes de iPhone: a la izquierda la categoría
// y a la derecha las unidades de esa categoría (al girar la categoría cambian las unidades). En iPhone son las ruedas nativas (giran
// con inercia y suena un «clic» por cada paso). Cancelar las descarta; «Listo» aplica la unidad.
const grupoDe = (codigo: string) => Math.max(0, GRUPOS_UNIDAD.findIndex((g) => g.unidades.some((u) => u.codigo === codigo)));
export function ElegirUnidad({ valor, alElegir }: { valor: string; alElegir: (codigo: string) => void }) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [rueda, setRueda] = useState(valor);
  const [grupo, setGrupo] = useState(grupoDe(valor));
  const abrir = () => {
    setRueda(valor);
    setGrupo(grupoDe(valor));
    setAbierto(true);
  };
  const elegirGrupo = (i: number) => {
    setGrupo(i);
    setRueda(GRUPOS_UNIDAD[i]!.unidades[0]!.codigo); // al cambiar de categoría se parte por su primera unidad
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
          <View style={e.ruedas}>
            <Picker selectedValue={grupo} onValueChange={(v) => elegirGrupo(Number(v))} itemStyle={{ color: t.texto, fontSize: 17 }} style={e.categoria} accessibilityLabel="Categoría">
              {GRUPOS_UNIDAD.map((g, i) => (
                <Picker.Item key={g.grupo} label={g.grupo} value={i} color={t.texto} />
              ))}
            </Picker>
            <Picker selectedValue={rueda} onValueChange={(v) => setRueda(String(v))} itemStyle={{ color: t.texto, fontSize: 20 }} style={e.detalle} accessibilityLabel="Unidad">
              {GRUPOS_UNIDAD[grupo]!.unidades.map((u) => (
                <Picker.Item key={u.codigo} label={textoUnidad(u)} value={u.codigo} color={t.texto} />
              ))}
            </Picker>
          </View>
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
  ruedas: { flexDirection: 'row', paddingHorizontal: espacio.s },
  categoria: { flex: 4, height: 216 },
  detalle: { flex: 5, height: 216 },
});
