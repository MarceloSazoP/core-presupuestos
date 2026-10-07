import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import { BotonM } from '@/components/material';
import { Icono, Texto } from '@/components/ui';
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
              <Text variant="titleSmall" style={{ color: t.error }}>Esto no se puede deshacer</Text>
              <Text variant="bodySmall" style={{ color: t.suave }}>Se elimina todo lo tuyo para siempre. Si quieres una copia, primero toca «Exportar mi data».</Text>
            </View>
          </View>
          <View style={e.lista}>
            {pierde.map((p) => (
              <View key={p} style={e.item}>
                <Icono nombre="cerrar" tamano={14} color={t.error} />
                <Text variant="bodyMedium" style={e.flex}>{p}</Text>
              </View>
            ))}
          </View>

          {destino === null ? (
            <>
              <Text variant="bodySmall" style={{ color: t.suave }}>Para confirmar, te enviaremos un código de 6 dígitos al correo de tu cuenta.</Text>
              <BotonM titulo="Enviar código a mi correo" icono="correo" colorIcono={t.acento} variante="contorno" onPress={() => void pedirCodigo()} cargando={enviando} />
            </>
          ) : (
            <>
              <Text variant="bodyMedium">Enviamos un código a <Text variant="bodyMedium" style={e.fuerte}>{destino}</Text>. Vale 10 minutos.</Text>
              <View>
                {/* Campo de Material con la etiqueta sobre el borde; el teclado es numérico y el sistema puede pegar el código del correo. */}
                <TextInput
                  mode="outlined"
                  label="Código del correo"
                  value={codigo}
                  onChangeText={(v) => { setCodigo(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  autoFocus
                  error={!!error}
                  placeholder="6 dígitos"
                  left={<TextInput.Icon icon={({ size, color }) => <Icono nombre="correo" tamano={size} color={color} />} />}
                  outlineStyle={e.borde}
                />
                {error ? <HelperText type="error" visible accessibilityRole="alert">{error}</HelperText> : null}
              </View>
              <BotonM titulo={eliminando ? 'Eliminando…' : 'Eliminar definitivamente'} icono="papelera" variante="peligro" disabled={codigo.length !== 6 || eliminando} onPress={() => void eliminar()} />
              <BotonM titulo="Reenviar el código" variante="texto" onPress={() => void pedirCodigo()} cargando={enviando} disabled={eliminando} />
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
  fuerte: { fontWeight: '700' },
  borde: { borderRadius: radio.m },
});
