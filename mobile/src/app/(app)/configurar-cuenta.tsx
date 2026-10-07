import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import { useDialogo } from '@/components/dialogo';
import { EliminarCuenta } from '@/components/eliminar-cuenta';
import { Card, Text } from 'react-native-paper';
import { FilaAccion, GrupoAjustes } from '@/components/fila-ajuste';
import { BotonM, SeccionM, TarjetaM } from '@/components/material';
import { Icono } from '@/components/ui';
import { avisar } from '@/lib/toast';
import { useSesion } from '@/session';
import { espacio, radio, useTema } from '@/theme';

// Mi cuenta (se abre tocando tu perfil en Configurar): con qué ingresas y, en listas de Material, el QR para volver a entrar, exportar tus
// datos y cerrar sesión; aparte, la zona de peligro para eliminar la cuenta (docs/Exportar y eliminar la cuenta.md).
export default function MiCuenta() {
  const t = useTema();
  const { usuario, salir } = useSesion();
  const { dialogo, decidir } = useDialogo();
  const [enviandoQr, setEnviandoQr] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function enviarQr() {
    setEnviandoQr(true);
    try {
      const r = await api<{ destination_masked: string }>('/me/recovery-qr', { method: 'POST' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      avisar.exito('Te lo enviamos', `Llegará a ${r.destination_masked}. El QR anterior ya no sirve.`);
    } catch (err) {
      avisar.error('No se pudo enviar el QR', mensajeDe(err));
    } finally {
      setEnviandoQr(false);
    }
  }

  // Exportar: un Excel con todos tus datos, al correo de la cuenta.
  const confirmarExportar = () =>
    decidir('Exportar mi data', 'Te enviaremos al correo de tu cuenta un Excel con tus clientes, presupuestos, ítems, visitas y seguimientos. Las fotos, notas de voz y PDF no van en el archivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar a mi correo', onPress: () => void exportar() },
    ]);
  async function exportar() {
    setExportando(true);
    try {
      const r = await api<{ destination_masked: string }>('/me/export', { method: 'POST' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      avisar.exito('Te lo enviamos', `El Excel llegará a ${r.destination_masked}.`);
    } catch (err) {
      avisar.error('No se pudo exportar', mensajeDe(err));
    } finally {
      setExportando(false);
    }
  }

  const confirmarSalida = () =>
    decidir('Cerrar sesión', `Saldrás de la cuenta de ${usuario?.name ?? 'tu usuario'}. Tus presupuestos quedan guardados.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void salir() },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      {/* Con qué ingresas: tu identidad. No se cambia aquí; lo que sale en tus presupuestos está en «Mis datos». */}
      <TarjetaM elevacion={2}>
        <Text variant="labelLarge" style={{ color: t.suave }}>Ingresas con</Text>
        <View style={e.dato}>
          <View style={[e.circulo, { backgroundColor: `${t.acento}1F` }]}><Icono nombre="llamar" tamano={18} color={t.acento} /></View>
          <Text variant="bodyLarge" numberOfLines={1} style={e.flex}>{usuario?.phone ?? ''}</Text>
        </View>
        <View style={e.dato}>
          <View style={[e.circulo, { backgroundColor: `${t.acento}1F` }]}><Icono nombre="correo" tamano={18} color={t.acento} /></View>
          <Text variant="bodyLarge" numberOfLines={1} style={e.flex}>{usuario?.email ?? ''}</Text>
        </View>
        <Text variant="bodySmall" style={{ color: t.suave }}>Son tu identidad y no se cambian aquí. El nombre, teléfono y correo que salen en tus presupuestos se cambian en «Mis datos».</Text>
      </TarjetaM>

      <SeccionM titulo="Acceso y datos">
        <GrupoAjustes>
          <FilaAccion icono="qr" color={t.acento} titulo="Enviar QR de recuperación" descripcion="Para volver a entrar si pierdes o cambias de teléfono. Llega a tu correo y deja sin efecto el anterior." cargando={enviandoQr} alTocar={() => void enviarQr()} />
          <FilaAccion icono="exportar" color={t.info} titulo="Exportar mi data" descripcion="Un Excel con tus clientes, presupuestos, ítems, visitas y seguimientos, a tu correo." cargando={exportando} alTocar={confirmarExportar} />
        </GrupoAjustes>
      </SeccionM>

      <SeccionM titulo="Sesión">
        <GrupoAjustes>
          <FilaAccion icono="salir" color={t.suave} titulo="Cerrar sesión" descripcion="Sales de la cuenta en este teléfono. Tus presupuestos quedan guardados." alTocar={confirmarSalida} />
        </GrupoAjustes>
      </SeccionM>

      {/* Zona de peligro: una tarjeta aparte, en el tono del error, con su botón rojo. */}
      <SeccionM titulo="Zona de peligro">
        {/* Una sola View dentro de la tarjeta: Card de Paper agrega `index` y `total` a cada hijo directo. */}
        <Card mode="contained" style={[e.peligro, { backgroundColor: `${t.error}14`, borderColor: `${t.error}55` }]}>
          <View style={e.contenidoPeligro}>
            <View style={e.dato}>
              <View style={[e.circulo, { backgroundColor: `${t.error}26` }]}><Icono nombre="alerta" tamano={18} color={t.error} /></View>
              <Text variant="titleMedium" style={[e.flex, { color: t.error }]}>Eliminar la cuenta</Text>
            </View>
            <Text variant="bodyMedium" style={{ color: t.suave }}>Borra todo lo tuyo para siempre: clientes, presupuestos, fotos y PDF. No se puede deshacer.</Text>
            <BotonM titulo="Eliminar mi cuenta" icono="papelera" variante="peligro" onPress={() => setEliminando(true)} />
          </View>
        </Card>
      </SeccionM>
      {eliminando ? <EliminarCuenta alCerrar={() => setEliminando(false)} /> : null}
      {dialogo}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  dato: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  circulo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  peligro: { borderRadius: radio.l, borderWidth: 1 },
  contenidoPeligro: { padding: espacio.l, gap: espacio.m },
});
