import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icono, Texto } from '@/components/ui';
import { bandera, PAISES_ORDENADOS, type Pais } from '@/lib/paises';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Hoja para elegir un país (en iPhone, la hoja nativa que se desliza desde abajo). Sirve para el país de la cuenta (moneda e
// impuesto) y para el código de país de un teléfono: `titulo`, `nota` y `detalle` dicen qué se muestra en cada caso.
export function ElegirPais({ titulo, nota, detalle, actual, alElegir, alCerrar }: { titulo: string; nota?: string; detalle: (p: Pais) => string; actual: string; alElegir: (country: string) => void; alCerrar: () => void }) {
  const t = useTema();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <View style={e.lado} />
          <Texto fuerte accessibilityRole="header">{titulo}</Texto>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={alCerrar} hitSlop={8} style={[e.lado, e.derecha]}>
            <Texto color="acento" fuerte>Cerrar</Texto>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={e.contenido}>
          {nota ? <Texto variante="chico" suave>{nota}</Texto> : null}
          <View style={[e.lista, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
            {PAISES_ORDENADOS.map((p, n) => (
              <Pressable
                key={p.country}
                accessibilityRole="radio"
                accessibilityState={{ selected: p.country === actual }}
                onPress={() => alElegir(p.country)}
                style={[e.fila, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }]}
              >
                <Texto style={e.bandera} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{bandera(p.country)}</Texto>
                <View style={e.flex}>
                  <Texto fuerte={p.country === actual}>{p.name}</Texto>
                  <Texto variante="chico" suave>{detalle(p)}</Texto>
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
  bandera: { fontSize: 24 },
});
