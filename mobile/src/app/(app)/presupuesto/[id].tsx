import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Cierre, Envio } from '@/components/cierre';
import { Seguimiento } from '@/components/seguimiento';
import { Levantamiento } from '@/components/levantamiento';
import { Boton, Pastilla, Texto } from '@/components/ui';
import { guardarCodigo, leerCodigo } from '@/lib/codigos';
import { clp } from '@/lib/formato';
import { espacio, useTema } from '@/theme';

// Detalle del presupuesto. Lo central de este hito: el código que se escribe en la web para completar o cerrar el
// presupuesto desde el computador (CLAUDE.md §16). Se muestra con letras grandes y se copia o comparte con un toque.
export default function Detalle() {
  const t = useTema();
  const { id, nuevo } = useLocalSearchParams<{ id: string; nuevo?: string }>();
  const [q, setQ] = useState<Presupuesto | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);

  const recargar = useCallback(async () => {
    try {
      setQ(await api<Presupuesto>(`/quotes/${id}`));
    } catch (err) {
      setError(mensajeDe(err));
    }
  }, [id]);

  useEffect(() => {
    void leerCodigo(id).then(setCodigo);
    api<Presupuesto>(`/quotes/${id}`).then(setQ).catch((err) => setError(mensajeDe(err)));
  }, [id]);

  const copiar = useCallback(async () => {
    if (!codigo) return;
    await Clipboard.setStringAsync(codigo);
    void Haptics.selectionAsync();
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }, [codigo]);

  async function generar() {
    setGenerando(true);
    try {
      const r = await api<{ code: string }>(`/quotes/${id}/access-code`, { method: 'POST', body: {} });
      await guardarCodigo(id, r.code);
      setCodigo(r.code);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('No se pudo generar el código', mensajeDe(err));
    } finally {
      setGenerando(false);
    }
  }

  // Un código nuevo deja sin efecto el anterior: se pide confirmación solo si ya hay uno.
  const pedirGenerar = () =>
    codigo
      ? Alert.alert('¿Generar un código nuevo?', 'El código actual dejará de funcionar y se cerrarán las sesiones abiertas con él.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Generar', style: 'destructive', onPress: () => void generar() },
        ])
      : void generar();

  const compartir = () => Share.share({ message: `Código de tu presupuesto en CorePresupuesto: ${codigo}` });

  if (!q) {
    return (
      <View style={[e.centro, { backgroundColor: t.fondo }]}>
        {error ? <Texto color="error" accessibilityRole="alert">{error}</Texto> : <ActivityIndicator color={t.suave} />}
      </View>
    );
  }

  const cerrado = q.doc_status === 'FINALIZED';
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Stack.Screen options={{ title: q.number ?? 'Presupuesto' }} />

      <View style={e.bloque}>
        <Pastilla texto={cerrado ? `Cerrado · ${q.number}` : 'Pendiente'} tono={cerrado ? 'ok' : 'aviso'} />
        <Texto variante="titulo">{q.customer.name}</Texto>
        <Texto suave>{q.customer.phone}</Texto>
        {q.service_description ? <Texto>{q.service_description}</Texto> : <Texto suave>Sin descripción todavía.</Texto>}
      </View>

      {nuevo === '1' ? (
        <View style={[e.exito, { borderColor: t.ok, backgroundColor: t.tarjeta }]}>
          <Texto fuerte color="ok">Presupuesto creado</Texto>
          <Texto variante="chico" suave>Ya puedes seguir en esta app o terminarlo en el computador con el código de abajo.</Texto>
        </View>
      ) : null}

      <View style={[e.tarjeta, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
        <Texto variante="chico" suave fuerte>CÓDIGO DEL PRESUPUESTO</Texto>
        {codigo ? (
          <>
            <Texto selectable adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.6} accessibilityLabel={`Código ${codigo.split('').join(' ')}`} style={e.codigo}>{codigo}</Texto>
            <Texto variante="chico" suave>Escríbelo en la caja «Consultar presupuesto» de la web para completar, editar o cerrar este presupuesto. No se lo des a tu cliente: a él se le envía el enlace del PDF.</Texto>
            <View style={e.fila}>
              <Boton titulo={copiado ? 'Copiado' : 'Copiar'} variante="secundario" onPress={copiar} style={e.mitad} />
              <Boton titulo="Compartir" variante="secundario" onPress={() => void compartir()} style={e.mitad} />
            </View>
            <Boton titulo="Generar un código nuevo" variante="texto" onPress={pedirGenerar} cargando={generando} />
          </>
        ) : (
          <>
            <Texto suave>El código solo se muestra una vez, y este teléfono no lo tiene guardado. Genera uno nuevo para usarlo en la web.</Texto>
            <Boton titulo="Generar código" onPress={pedirGenerar} cargando={generando} />
          </>
        )}
      </View>

      {cerrado ? <Envio q={q} recargar={recargar} /> : <Levantamiento q={q} recargar={recargar} />}
      {cerrado && q.commercial_status !== 'NONE' ? <Seguimiento q={q} recargar={recargar} /> : null}
      {cerrado ? null : <Cierre q={q} recargar={recargar} />}

      {cerrado && q.items.length ? (
        <View style={e.bloque}>
          <Texto variante="subtitulo">Ítems</Texto>
          {q.items.map((i) => (
            <View key={i.id} style={e.item}>
              <View style={e.itemTexto}>
                <Texto>{i.description}</Texto>
                <Texto variante="chico" suave>{i.quantity} {i.unit} × {clp(i.unit_price)}</Texto>
              </View>
              <Texto fuerte style={e.monto}>{clp(i.line_total)}</Texto>
            </View>
          ))}
          <View style={[e.item, { borderTopColor: t.borde, borderTopWidth: 1, paddingTop: espacio.m }]}>
            <Texto fuerte>Total</Texto>
            <Texto variante="subtitulo" style={e.monto}>{clp(q.total)}</Texto>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  contenido: { padding: espacio.l, gap: espacio.xl },
  bloque: { gap: espacio.s },
  exito: { borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', padding: espacio.l, gap: espacio.xs },
  tarjeta: { borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: espacio.xl, gap: espacio.m },
  // El alto de línea va con la letra: Texto trae uno de 22 pt y con letra de 26 recortaba la parte de arriba.
  codigo: { fontSize: 26, lineHeight: 36, fontWeight: '600', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.m },
  itemTexto: { flex: 1 },
  monto: { fontVariant: ['tabular-nums'] },
});
