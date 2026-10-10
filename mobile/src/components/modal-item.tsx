import { useState } from 'react';
import { ElegirUnidad } from '@/components/elegir-unidad';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BarraListo } from '@/components/barra-listo';
import { Chip } from 'react-native-paper';
import { BotonM, BotonVolver, DeslizarParaVolver, TextoM } from '@/components/material';
import { Campo, Icono } from '@/components/ui';
import { dinero, montoEscrito, soloDigitos } from '@/lib/formato';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// `tipo`: un ítem es cantidad × precio; una tarea (botar escombros, limpiar bodega) no tiene cantidad ni unidad y su valor
// es opcional: vacío = incluida en el presupuesto.
export type Fila = { clave: string; tipo: 'item' | 'tarea'; description: string; quantity: string; unit: string; unit_price: string };

export const numero = (s: string) => Number(s.replace(',', '.'));
export const entero = (s: string) => Number(s.replace(/\D/g, '') || 0);
export const valorDe = (f: Fila) => (f.tipo === 'tarea' ? entero(f.unit_price) : Math.round(numero(f.quantity) * entero(f.unit_price)) || 0);

export function Chips<T extends string>({ opciones, valor, alElegir, etiqueta }: { opciones: readonly { id: T; texto: string }[]; valor: string; alElegir: (v: T) => void; etiqueta: string }) {
  const t = useTema();
  // Chips de filtro de Material 3: el elegido en el tono suave del acento con su ✓; los demás, solo con el contorno. Miden 32 de alto
  // y el área de toque se agranda a 48 con `hitSlop`.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={etiqueta} contentContainerStyle={e.chips}>
      {opciones.map((o) => {
        const elegido = o.id === valor;
        return (
          <Chip
            key={o.id}
            mode="outlined"
            selected={elegido}
            showSelectedCheck={false}
            icon={elegido ? ({ size, color }) => <Icono nombre="listo" tamano={size} color={color} /> : undefined}
            onPress={() => alElegir(o.id)}
            accessibilityRole="radio"
            hitSlop={{ top: 8, bottom: 8 }}
            style={[e.chip, elegido ? { backgroundColor: `${t.acento}26`, borderColor: 'transparent' } : { backgroundColor: 'transparent', borderColor: t.bordeCampo }]}
            textStyle={[e.textoChip, { color: t.texto }, elegido ? e.chipElegido : null]}
          >
            {o.texto}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

// Hoja para agregar o editar un ítem o una tarea (en iPhone, la hoja nativa que se desliza desde abajo). Trabaja sobre una copia:
// «Cancelar» la descarta y «Agregar» / «Guardar» la guarda en la lista. Un ítem nuevo sin descripción no se puede agregar.
export function ModalItem({ fila, nueva, moneda, alGuardar, alQuitar, alCerrar }: { fila: Fila; nueva: boolean; moneda: string; alGuardar: (f: Fila) => void; alQuitar: () => void; alCerrar: () => void }) {
  const t = useTema();
  const [f, setF] = useState(fila);
  const [error, setError] = useState<string | null>(null);
  const tarea = f.tipo === 'tarea';
  const cambiar = (campo: keyof Fila, v: string) => {
    setError(null);
    setF((x) => ({ ...x, [campo]: v }));
  };

  function guardar() {
    if (!f.description.trim()) return setError(tarea ? 'Escribe qué se hace.' : 'Escribe qué vas a hacer o vender.');
    if (!tarea && !(numero(f.quantity) > 0)) return setError('La cantidad debe ser mayor que 0.');
    alGuardar({ ...f, description: f.description.trim() });
  }

  const total = tarea ? (f.unit_price ? dinero(entero(f.unit_price), moneda) : 'Incluido') : dinero(valorDe(f), moneda);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <DeslizarParaVolver alVolver={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <View style={e.lado}>
            <BotonVolver titulo="Cancelar" onPress={alCerrar} />
          </View>
          <TextoM fuerte accessibilityRole="header">{nueva ? (tarea ? 'Nueva tarea' : 'Nuevo ítem') : tarea ? 'Tarea' : 'Ítem'}</TextoM>
          <Pressable accessibilityRole="button" accessibilityLabel={nueva ? 'Agregar' : 'Guardar'} onPress={guardar} hitSlop={8} style={[e.lado, e.derecha]}>
            <TextoM color="acento" fuerte>{nueva ? 'Agregar' : 'Guardar'}</TextoM>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={e.contenido}>
          <Campo
            etiqueta={tarea ? 'Qué se hace' : 'Descripción'}
            value={f.description}
            onChangeText={(v) => cambiar('description', v)}
            placeholder={tarea ? 'Por ejemplo: botar escombros' : 'Qué vas a hacer o vender'}
            maxLength={300}
            autoFocus={nueva}
            multiline
            style={e.descripcion}
          />

          {tarea ? (
            <Campo etiqueta="Valor (opcional)" value={montoEscrito(f.unit_price, moneda)} onChangeText={(v) => cambiar('unit_price', soloDigitos(v))} keyboardType="number-pad" placeholder="$ 0" ayuda="Si lo dejas vacío, la tarea va incluida en el presupuesto." />
          ) : (
            <>
              <View style={e.fila}>
                <View style={e.mitad}>
                  <Campo etiqueta="Cantidad" value={f.quantity} onChangeText={(v) => cambiar('quantity', v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" selectTextOnFocus />
                </View>
                <View style={e.mitad}>
                  <Campo etiqueta="Precio unitario" value={montoEscrito(f.unit_price, moneda)} onChangeText={(v) => cambiar('unit_price', soloDigitos(v))} keyboardType="number-pad" placeholder="$ 0" />
                </View>
              </View>
              <View style={e.grupo}>
                <TextoM variante="chico" fuerte>Unidad</TextoM>
                <ElegirUnidad valor={f.unit} alElegir={(u) => cambiar('unit', u)} />
              </View>
            </>
          )}

          {error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM> : null}

          {/* El resultado de la línea, bien a la vista: es lo que importa al terminar de llenar. */}
          <View style={[e.total, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
            <TextoM suave>{tarea ? 'Valor en el presupuesto' : 'Total de la línea'}</TextoM>
            <TextoM variante="titulo" style={e.monto}>{total}</TextoM>
          </View>

          {nueva ? null : <BotonM titulo={tarea ? 'Quitar esta tarea' : 'Quitar este ítem'} icono="cerrar" variante="peligro" onPress={alQuitar} />}
        </ScrollView>
      </View>
      <BarraListo />
      </DeslizarParaVolver>
    </Modal>
  );
}

const e = StyleSheet.create({
  hoja: { flex: 1 },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  derecha: { alignItems: 'flex-end' },
  contenido: { padding: espacio.xl, paddingBottom: espacio.xxl * 2, gap: espacio.l },
  descripcion: { minHeight: 72 },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  grupo: { gap: espacio.s },
  chips: { gap: espacio.s },
  chip: { borderRadius: 8, marginVertical: espacio.s },
  textoChip: { fontSize: 15 },
  chipElegido: { fontWeight: '600' },
  total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.l },
  monto: { fontVariant: ['tabular-nums'] },
});
