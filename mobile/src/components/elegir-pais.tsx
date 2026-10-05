import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icono, Texto } from '@/components/ui';
import { PAISES } from '@/lib/paises';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Hoja para elegir el país (moneda e impuesto de los presupuestos nuevos). En iPhone, la hoja nativa que se desliza desde abajo.
export function ElegirPais({ actual, alElegir, alCerrar }: { actual: string; alElegir: (country: string) => void; alCerrar: () => void }) {
  const t = useTema();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <View style={e.lado} />
          <Texto fuerte accessibilityRole="header">País</Texto>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={alCerrar} hitSlop={8} style={[e.lado, e.derecha]}>
            <Texto color="acento" fuerte>Cerrar</Texto>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={e.contenido}>
          <Texto variante="chico" suave>Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian.</Texto>
          <View style={[e.lista, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
            {PAISES.map((p, n) => (
              <Pressable
                key={p.country}
                accessibilityRole="radio"
                accessibilityState={{ selected: p.country === actual }}
                onPress={() => alElegir(p.country)}
                style={[e.fila, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }]}
              >
                <View style={e.flex}>
                  <Texto fuerte={p.country === actual}>{p.name}</Texto>
                  <Texto variante="chico" suave>{p.currency} · {p.vat_label} {p.vat_rate} %</Texto>
                </View>
                {p.country === actual ? <Icono nombre="listo" tamano={18} color={t.acento} /> : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  hoja: { flex: 1 },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  derecha: { alignItems: 'flex-end' },
  contenido: { padding: espacio.l, gap: espacio.m },
  lista: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', overflow: 'hidden' },
  fila: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l, paddingVertical: espacio.s },
  flex: { flex: 1 },
});
