import * as Clipboard from 'expo-clipboard';
import { avisar } from '@/lib/toast';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import { useDialogo } from '@/components/dialogo';
import { BotonM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { guardarCodigo, leerCodigo } from '@/lib/codigos';
import { AvisoSinSenal } from '@/components/sincronizacion';
import { useSinSenal } from '@/lib/conexion';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MONO, radio, useTema } from '@/theme';

// Hoja del código del presupuesto (CLAUDE.md §16). El código es la llave para abrir este presupuesto en la web: se usa una vez por
// presupuesto, así que vive en una hoja aparte y no ocupa la pantalla principal. Se escribe en la web o se abre leyendo su QR.
export default function Codigo() {
  const t = useTema();
  const { id, titulo, codeId } = useLocalSearchParams<{ id: string; titulo: string; codeId?: string }>();
  const [codigo, setCodigo] = useState<string | null>(null);
  const sinSenal = useSinSenal(); // generar el código y leer el QR de la web van al servidor
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const { dialogo, decidir } = useDialogo();

  useEffect(() => void leerCodigo(id).then(setCodigo), [id]);

  async function copiar() {
    if (!codigo) return;
    await Clipboard.setStringAsync(codigo);
    void Haptics.selectionAsync();
    setCopiado(true);
    avisar.exito('Código copiado');
    setTimeout(() => setCopiado(false), 2000);
  }

  async function generar() {
    setGenerando(true);
    try {
      await asegurarSincronizado(id);
      const r = await api<{ code: string }>(`/quotes/${id}/access-code`, { method: 'POST', body: {} });
      await guardarCodigo(id, r.code);
      setCodigo(r.code);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      avisar.error('No se pudo generar el código', mensajeDe(err));
    } finally {
      setGenerando(false);
    }
  }

  // Un código nuevo deja sin efecto el anterior: se pide confirmación solo si ya hay uno.
  const pedirGenerar = () =>
    codigo
      ? decidir('¿Generar un código nuevo?', 'El código actual dejará de funcionar y se cerrarán las sesiones abiertas con él.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Generar', style: 'destructive', onPress: () => void generar() },
        ])
      : void generar();

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido} contentInsetAdjustmentBehavior="automatic">
      <View style={e.cabecera}>
        <TextoM variante="subtitulo" accessibilityRole="header">Abrir en la web</TextoM>
        <TextoM variante="chico" suave numberOfLines={1}>{titulo}</TextoM>
      </View>

      {codigo ? (
        <TarjetaM>
          {/* El código en un talón punteado dentro de la tarjeta: es lo que se dicta o se escribe en la web. */}
          <View style={[e.ticket, { borderColor: t.bordeCampo }]}>
            <TextoM variante="chico" suave fuerte>Código</TextoM>
            <TextoM selectable adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.6} accessibilityLabel={`Código ${codigo.split('').join(' ')}`} style={e.codigo}>{codigo}</TextoM>
          </View>
          <View style={e.fila}>
            <Animated.View key={copiado ? 'copiado' : 'copiar'} entering={FadeIn.duration(120)} style={e.mitad}>
              <BotonM titulo={copiado ? 'Copiado' : 'Copiar'} icono={copiado ? 'listo' : 'copiar'} variante="secundario" onPress={() => void copiar()} />
            </Animated.View>
            <BotonM titulo="Compartir" icono="compartir" variante="secundario" onPress={() => void Share.share({ message: `Código de tu presupuesto en CORE Presupuestos: ${codigo}` })} style={e.mitad} />
          </View>
          <TextoM variante="chico" suave>Escríbelo en la caja «Consultar presupuesto» de la web. No se lo des a tu cliente: a él se le envía el enlace del PDF.</TextoM>
        </TarjetaM>
      ) : codeId ? (
        <TarjetaM>
          <TextoM>El código solo se muestra una vez y este teléfono no lo tiene guardado. Genera uno nuevo para usarlo en la web.</TextoM>
          <BotonM titulo="Generar código" onPress={pedirGenerar} cargando={generando} disabled={sinSenal} />
          {sinSenal ? <AvisoSinSenal texto="para generar el código, necesitas internet." /> : null}
        </TarjetaM>
      ) : (
        <TarjetaM>
          <TextoM suave>Este presupuesto se creó sin conexión. Su código aparece aquí en cuanto se sincronice con el servidor.</TextoM>
        </TarjetaM>
      )}

      <SeccionM titulo="Sin escribir el código" icono="qr" descripcion="Abre este presupuesto en el computador escaneando el QR de la portada de la web.">
        <BotonM titulo="Leer el QR de la web" icono="qr" disabled={sinSenal} onPress={() => router.replace({ pathname: '/escanear', params: { id, titulo } })} />
        {sinSenal ? <AvisoSinSenal texto="para abrirlo en la web, necesitas internet." /> : null}
      </SeccionM>

      {codigo ? <BotonM titulo="Generar un código nuevo" variante="texto" onPress={pedirGenerar} cargando={generando} disabled={sinSenal} /> : null}
      {dialogo}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.xl },
  cabecera: { gap: 2, paddingTop: espacio.s },
  ticket: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radio.m, borderCurve: 'continuous', paddingVertical: espacio.l, paddingHorizontal: espacio.m, alignItems: 'center', gap: espacio.xs },
  // El alto de línea va con la letra: con 24 pt y el alto de 22 del cuerpo se recortaba la parte de arriba.
  codigo: { fontFamily: Platform.select(MONO), fontSize: 26, lineHeight: 34, fontWeight: '600', letterSpacing: 1.5 },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
});
