import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import { Boton, Campo, Icono, Presionable, Texto } from '@/components/ui';
import { olvidarAcceso } from '@/lib/ultimo-acceso';
import { avisar } from '@/lib/toast';
import { useSesion } from '@/session';
import { limpiarTodo } from '@/sync/db';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Eliminar la cuenta en dos pasos (docs/Exportar y eliminar la cuenta.md §2): se explica lo que se pierde, se envía un código al correo de la
// cuenta y, con los 6 dígitos, se elimina todo. «Eliminar definitivamente» solo se enciende con el código completo.
export function EliminarCuenta({ alCerrar }: { alCerrar: () => void }) {
  const t = useTema();
  const { salir } = useSesion();
  const [destino, setDestino] = useState<string | null>(null); // el correo (enmascarado) al que se envió el código
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedirCodigo() {
    setEnviando(true);
    setError(null);
    try {
      const r = await api<{ destination_masked: string }>('/me/delete-request', { method: 'POST' });
      setDestino(r.destination_masked);
      setCodigo('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (err) {
      avisar.error('No se pudo enviar el código', mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar() {
    setEliminando(true);
    setError(null);
    try {
      await api('/me/delete', { method: 'POST', body: { code: codigo } });
      // La cuenta ya no existe: se borra también lo guardado en este teléfono y se vuelve a la pantalla de ingreso.
      await Promise.all([limpiarTodo().catch(() => {}), olvidarAcceso()]);
      alCerrar();
      await salir();
    } catch (err) {
      setError(mensajeDe(err));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setEliminando(false);
    }
  }

  const pierde = ['Tus clientes y todos tus presupuestos, también los enviados', 'Las fotos, las notas de voz y los PDF', 'Tu logo y tu firma', 'Los enlaces que ya enviaste a tus clientes dejarán de funcionar'];
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={alCerrar} hitSlop={8} style={e.lado}>
            <Texto color="acento">Cancelar</Texto>
          </Pressable>
          <Texto fuerte accessibilityRole="header">Eliminar cuenta</Texto>
          <View style={e.lado} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={e.contenido}>
          <View style={[e.aviso, { backgroundColor: `${t.error}14`, borderColor: `${t.error}55` }]}>
            <Icono nombre="alerta" tamano={22} color={t.error} />
            <View style={e.flex}>
              <Texto fuerte color="error">Esto no se puede deshacer</Texto>
              <Texto variante="chico" suave>Se elimina todo lo tuyo para siempre. Si quieres una copia, primero toca «Exportar mi data».</Texto>
            </View>
          </View>
          <View style={e.lista}>
            {pierde.map((p) => (
              <View key={p} style={e.item}>
                <Icono nombre="cerrar" tamano={14} color={t.error} />
                <Texto style={e.flex}>{p}</Texto>
              </View>
            ))}
          </View>

          {destino === null ? (
            <>
              <Texto variante="chico" suave>Para confirmar, te enviaremos un código de 6 dígitos al correo de tu cuenta.</Texto>
              <Boton titulo="Enviar código a mi correo" icono="correo" colorIcono={t.acento} variante="secundario" onPress={() => void pedirCodigo()} cargando={enviando} />
            </>
          ) : (
            <>
              <Texto>Enviamos un código a <Texto fuerte>{destino}</Texto>. Vale 10 minutos.</Texto>
              <Campo etiqueta="Código del correo" icono="correo" value={codigo} onChangeText={(v) => { setCodigo(v.replace(/\D/g, '').slice(0, 6)); setError(null); }} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp" autoFocus error={error} placeholder="6 dígitos" />
              <Presionable accessibilityRole="button" accessibilityState={{ disabled: codigo.length !== 6 || eliminando }} disabled={codigo.length !== 6 || eliminando} onPress={() => void eliminar()} estilo={[e.eliminar, { backgroundColor: t.error, opacity: codigo.length === 6 && !eliminando ? 1 : 0.4 }]}>
                <Icono nombre="papelera" tamano={18} color="#FFFFFF" />
                <Texto fuerte style={e.textoEliminar}>{eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}</Texto>
              </Presionable>
              <Boton titulo="Reenviar el código" variante="texto" onPress={() => void pedirCodigo()} cargando={enviando} disabled={eliminando} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  hoja: { flex: 1 },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  contenido: { padding: espacio.xl, gap: espacio.l, paddingBottom: espacio.xxl },
  flex: { flex: 1 },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.m },
  lista: { gap: espacio.s },
  item: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  eliminar: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.l },
  textoEliminar: { color: '#FFFFFF' },
});
