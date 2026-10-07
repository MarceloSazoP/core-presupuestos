import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import { BotonM, CampoM, HojaM, TarjetaM } from '@/components/material';
import { Icono } from '@/components/ui';
import { olvidarAcceso } from '@/lib/ultimo-acceso';
import { avisar } from '@/lib/toast';
import { useSesion } from '@/session';
import { limpiarTodo } from '@/sync/db';
import { espacio, radio, useTema } from '@/theme';

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
    <HojaM titulo="Eliminar cuenta" cancelar={{ titulo: 'Cancelar', onPress: alCerrar }} alCerrar={alCerrar}>
      {/* El aviso en el tono del error y, en una tarjeta, todo lo que se pierde. */}
      <Card mode="contained" style={[e.aviso, { backgroundColor: `${t.error}14`, borderColor: `${t.error}55` }]}>
        <View style={e.filaAviso}>
          <Icono nombre="alerta" tamano={22} color={t.error} />
          <View style={e.flex}>
            <Text variant="titleSmall" style={{ color: t.error }}>Esto no se puede deshacer</Text>
            <Text variant="bodySmall" style={{ color: t.suave }}>Se elimina todo lo tuyo para siempre. Si quieres una copia, primero toca «Exportar mi data».</Text>
          </View>
        </View>
      </Card>
      <TarjetaM>
        <Text variant="labelLarge" style={{ color: t.suave }}>Se pierde</Text>
        {pierde.map((p) => (
          <View key={p} style={e.item}>
            <Icono nombre="cerrar" tamano={14} color={t.error} />
            <Text variant="bodyMedium" style={e.flex}>{p}</Text>
          </View>
        ))}
      </TarjetaM>

      <TarjetaM>
        {destino === null ? (
          <>
            <Text variant="bodyMedium" style={{ color: t.suave }}>Para confirmar, te enviaremos un código de 6 dígitos al correo de tu cuenta.</Text>
            <BotonM titulo="Enviar código a mi correo" icono="correo" colorIcono={t.acento} variante="contorno" onPress={() => void pedirCodigo()} cargando={enviando} />
          </>
        ) : (
          <>
            <Text variant="bodyMedium">Enviamos un código a <Text variant="bodyMedium" style={e.fuerte}>{destino}</Text>. Vale 10 minutos.</Text>
            {/* El teclado es numérico y el sistema puede pegar el código del correo. */}
            <CampoM
              etiqueta="Código del correo"
              value={codigo}
              onChangeText={(v) => { setCodigo(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              error={error}
              placeholder="6 dígitos"
            />
            <BotonM titulo={eliminando ? 'Eliminando…' : 'Eliminar definitivamente'} icono="papelera" variante="peligro" disabled={codigo.length !== 6 || eliminando} onPress={() => void eliminar()} />
            <BotonM titulo="Reenviar el código" variante="texto" onPress={() => void pedirCodigo()} cargando={enviando} disabled={eliminando} />
          </>
        )}
      </TarjetaM>
    </HojaM>
  );
}

const e = StyleSheet.create({
  flex: { flex: 1 },
  aviso: { borderRadius: radio.l, borderWidth: 1 },
  filaAviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, padding: espacio.l },
  item: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  fuerte: { fontWeight: '700' },
});
