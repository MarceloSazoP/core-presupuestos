import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type TextInputProps } from 'react-native';
import { Boton, Campo, Icono, Texto } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Un texto largo (servicio, dirección, notas) que se escribe en su propia hoja: vacío es un botón «Agregar …»; con texto, la
// tarjeta con lo escrito, que se toca para editarlo. La hoja tiene el campo con todo el espacio y un «Listo» ancho; «Cancelar»
// la cierra sin cambiar nada.
type Entrada = Pick<TextInputProps, 'maxLength' | 'autoComplete' | 'textContentType' | 'autoCapitalize' | 'autoCorrect' | 'keyboardType'>;
type Props = {
  etiqueta: string;
  titulo: string; // título de la hoja, p. ej. «Servicio»
  agregar: string; // texto del botón cuando está vacío, p. ej. «Agregar servicio»
  valor: string;
  alCambiar: (v: string) => void;
  placeholder?: string;
  ayuda?: string;
  error?: string | null;
  multiline?: boolean;
} & Entrada;

export function CampoModal({ etiqueta, titulo, agregar, valor, alCambiar, placeholder, ayuda, error, multiline = true, ...entrada }: Props) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const lleno = valor.trim().length > 0;
  return (
    <View style={e.campo}>
      <Texto variante="chico" fuerte>{etiqueta}</Texto>
      {lleno ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor}. Editar`} onPress={() => setAbierto(true)} style={({ pressed }) => [e.tarjeta, { backgroundColor: t.tarjeta, borderColor: error ? t.error : t.bordeCampo, opacity: pressed ? 0.7 : 1 }]}>
          <Texto style={e.flex} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{valor}</Texto>
          <Icono nombre="lapiz" tamano={18} color={t.acento} />
        </Pressable>
      ) : (
        <Boton titulo={agregar} icono="mas" variante="secundario" onPress={() => setAbierto(true)} />
      )}
      {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : ayuda ? <Texto variante="chico" suave>{ayuda}</Texto> : null}
      {abierto ? (
        <Hoja
          titulo={titulo}
          etiqueta={etiqueta}
          inicial={valor}
          placeholder={placeholder}
          multiline={multiline}
          entrada={entrada}
          alListo={(v) => {
            setAbierto(false);
            if (v !== valor) alCambiar(v);
          }}
          alCerrar={() => setAbierto(false)}
        />
      ) : null}
    </View>
  );
}

function Hoja({ titulo, etiqueta, inicial, placeholder, multiline, entrada, alListo, alCerrar }: { titulo: string; etiqueta: string; inicial: string; placeholder?: string; multiline: boolean; entrada: Entrada; alListo: (v: string) => void; alCerrar: () => void }) {
  const t = useTema();
  const [v, setV] = useState(inicial); // copia: «Cancelar» la descarta
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={alCerrar} hitSlop={8} style={e.lado}>
            <Texto color="acento">Cancelar</Texto>
          </Pressable>
          <Texto fuerte accessibilityRole="header">{titulo}</Texto>
          <View style={e.lado} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={e.contenido}>
          <Campo etiqueta={etiqueta} value={v} onChangeText={setV} placeholder={placeholder} multiline={multiline} autoFocus style={multiline ? e.grande : undefined} {...entrada} />
          <Boton titulo="Listo" icono="listo" onPress={() => alListo(v.trim())} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  campo: { gap: espacio.xs },
  flex: { flex: 1 },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.m, minHeight: MIN_TOQUE },
  hoja: { flex: 1 },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  contenido: { padding: espacio.xl, gap: espacio.l },
  grande: { minHeight: 160 },
});
