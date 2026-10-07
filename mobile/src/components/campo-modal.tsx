import { useState } from 'react';
import { palabrasDe, recortarPalabras } from '@/lib/palabras';
import { StyleSheet, View, type TextInputProps } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import { BotonM, CampoM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { Icono, type NombreIcono } from '@/components/ui';
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
  icono?: NombreIcono; // el ícono del campo (persona, sobre, maletín…): va de color en el botón y en la tarjeta
  multiline?: boolean;
  maxPalabras?: number; // tope de palabras (se corta al escribir y se muestra la cuenta)
} & Entrada;

export function CampoModal({ etiqueta, titulo, agregar, valor, alCambiar, placeholder, ayuda, error, icono = 'mas', multiline = true, maxPalabras, ...entrada }: Props) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const lleno = valor.trim().length > 0;
  return (
    <View style={e.campo}>
      <TextoM variante="chico" fuerte>{etiqueta}</TextoM>
      {lleno ? (
        // Lo escrito, con el contorno de un campo de Material sobre la superficie donde está (sin fondo propio) y la onda al tocar.
        <TouchableRipple accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor}. Editar`} onPress={() => setAbierto(true)} borderless style={[e.tarjeta, { borderColor: error ? t.error : t.bordeCampo }]}>
          <View style={e.filaTarjeta}>
            <Icono nombre={icono} tamano={18} color={t.acento} />
            <TextoM style={e.flex}>{valor}</TextoM>
            <Icono nombre="lapiz" tamano={18} color={t.acento} />
          </View>
        </TouchableRipple>
      ) : (
        <BotonM titulo={agregar} icono={icono} colorIcono={t.acento} variante="contorno" onPress={() => setAbierto(true)} />
      )}
      {error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM> : ayuda ? <TextoM variante="chico" suave>{ayuda}</TextoM> : null}
      {abierto ? (
        <Hoja
          titulo={titulo}
          etiqueta={etiqueta}
          inicial={valor}
          placeholder={placeholder}
          multiline={multiline}
          maxPalabras={maxPalabras}
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

// La hoja de edición de Material: «Cancelar» y «Listo» arriba, el campo con contorno en una tarjeta y un «Listo» ancho abajo, a mano.
function Hoja({ titulo, etiqueta, inicial, placeholder, multiline, maxPalabras, entrada, alListo, alCerrar }: { titulo: string; etiqueta: string; inicial: string; placeholder?: string; multiline: boolean; maxPalabras?: number; entrada: Entrada; alListo: (v: string) => void; alCerrar: () => void }) {
  const [v, setV] = useState(inicial); // copia: «Cancelar» la descarta
  return (
    <HojaM titulo={titulo} cancelar={{ titulo: 'Cancelar', onPress: alCerrar }} listo={{ titulo: 'Listo', fuerte: true, onPress: () => alListo(v.trim()) }} alCerrar={alCerrar}>
      <TarjetaM>
        <CampoM etiqueta={etiqueta} value={v} onChangeText={(x) => setV(maxPalabras ? recortarPalabras(x, maxPalabras) : x)} placeholder={placeholder} multiline={multiline} autoFocus {...entrada} />
        {maxPalabras ? <TextoM variante="chico" suave style={e.cuenta}>{palabrasDe(v).length} de {maxPalabras} palabras</TextoM> : null}
      </TarjetaM>
      <BotonM titulo="Listo" icono="listo" onPress={() => alListo(v.trim())} />
    </HojaM>
  );
}

const e = StyleSheet.create({
  campo: { gap: espacio.xs },
  flex: { flex: 1 },
  tarjeta: { borderWidth: 1, borderRadius: radio.s, padding: espacio.m, minHeight: MIN_TOQUE, justifyContent: 'center' },
  filaTarjeta: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  cuenta: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
