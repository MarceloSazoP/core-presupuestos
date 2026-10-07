import { StyleSheet, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { ElegirDescuento } from '@/components/elegir-descuento';
import { Chips } from '@/components/modal-item';
import { BotonM, CampoM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

export const GARANTIAS = [{ kind: 'D30', texto: '30 días' }, { kind: 'M3', texto: '3 meses' }, { kind: 'M6', texto: '6 meses' }, { kind: 'Y1', texto: '1 año' }, { kind: 'LIFETIME', texto: 'De por vida' }] as const;

// Las condiciones del presupuesto en su propia ventana: descuento, garantía, validez y observaciones. Edita directamente lo de la pantalla
// del presupuesto (no hay copia que descartar); «Listo» solo la cierra. El impuesto (IVA) no está aquí: va bajo el total.
export function ModalCondiciones({ pct, alDescuento, descuentoFijo, garantia, alGarantia, dias, alDias, obs, alObs, alCerrar }: {
  pct: number | null;
  alDescuento: (p: number) => void;
  descuentoFijo: string; // «Descuento fijo $X», si el descuento guardado no es un porcentaje exacto
  garantia: string;
  alGarantia: (g: string) => void;
  dias: string;
  alDias: (d: string) => void;
  obs: string;
  alObs: (o: string) => void;
  alCerrar: () => void;
}) {
  const t = useTema();
  return (
    <HojaM titulo="Condiciones" listo={{ titulo: 'Listo', fuerte: true, onPress: alCerrar }} alCerrar={alCerrar}>
      <TarjetaM>
        <View style={e.grupo}>
          <TextoM variante="chico" fuerte>Descuento (opcional)</TextoM>
          <ElegirDescuento valor={pct} respaldo={descuentoFijo} alElegir={alDescuento} />
        </View>
      </TarjetaM>

      {/* Un interruptor: apagado es «sin garantía»; al encenderlo aparecen las duraciones (30 días por defecto). */}
      <TarjetaM>
        <View style={e.fila}>
          <TextoM style={e.flex}>Garantía</TextoM>
          <Switch accessibilityLabel="Garantía" value={garantia !== 'NONE'} onValueChange={(on) => alGarantia(on ? 'D30' : 'NONE')} color={t.acento} />
        </View>
        {garantia !== 'NONE' ? (
          <View style={e.grupo}>
            <TextoM variante="chico" fuerte>Duración</TextoM>
            <Chips etiqueta="Duración de la garantía" opciones={GARANTIAS.map((g) => ({ id: g.kind, texto: g.texto }))} valor={garantia} alElegir={alGarantia} />
          </View>
        ) : null}
      </TarjetaM>

      <TarjetaM>
        <CampoM etiqueta="Validez del presupuesto (días)" value={dias} onChangeText={(v) => alDias(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
        <CampoM etiqueta="Observaciones (opcional)" value={obs} onChangeText={alObs} multiline maxLength={5000} placeholder="Plazos, forma de pago, lo que incluye…" />
      </TarjetaM>
      <BotonM titulo="Listo" icono="listo" onPress={alCerrar} />
    </HojaM>
  );
}

const e = StyleSheet.create({
  grupo: { gap: espacio.s },
  fila: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  flex: { flex: 1 },
});
