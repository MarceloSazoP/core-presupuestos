import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import { EliminarCuenta } from '@/components/eliminar-cuenta';
import { Boton, Seccion, Texto } from '@/components/ui';
import { avisar } from '@/lib/toast';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// Mi cuenta: el QR para volver a entrar, exportar tus datos, cerrar sesión y eliminar la cuenta (docs/Exportar y eliminar la cuenta.md).
export default function MiCuenta() {
  const t = useTema();
  const { usuario, salir } = useSesion();
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
    Alert.alert('Exportar mi data', 'Te enviaremos al correo de tu cuenta un Excel con tus clientes, presupuestos, ítems, visitas y seguimientos. Las fotos, notas de voz y PDF no van en el archivo.', [
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
    Alert.alert('Cerrar sesión', `Saldrás de la cuenta de ${usuario?.name ?? 'tu usuario'}. Tus presupuestos quedan guardados.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void salir() },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Seccion titulo="Entrar en otro teléfono" icono="qr" descripcion={`Ingresas con ${usuario?.phone ?? ''} y ${usuario?.email ?? ''}. Esos datos no se cambian aquí.`}>
        <Boton titulo="Enviar QR de recuperación a mi correo" icono="qr" icono2="correo" colorIcono={t.acento} variante="secundario" onPress={() => void enviarQr()} cargando={enviandoQr} />
        <Texto variante="chico" suave>Sirve para volver a entrar si pierdes o cambias de teléfono, aunque no recuerdes el número. Pedir uno nuevo deja sin efecto el anterior.</Texto>
      </Seccion>

      <Seccion titulo="Tus datos" icono="exportar" descripcion="Te llevas una copia de todo lo tuyo.">
        <Boton titulo="Exportar mi data" icono="exportar" colorIcono={t.acento} variante="secundario" onPress={confirmarExportar} cargando={exportando} />
      </Seccion>

      <Seccion titulo="Sesión" icono="salir">
        <Boton titulo="Cerrar sesión" icono="salir" colorIcono={t.error} variante="secundario" onPress={confirmarSalida} />
      </Seccion>

      <Seccion titulo="Zona de peligro" icono="alerta" descripcion="Eliminar la cuenta borra todo lo tuyo para siempre y no se puede deshacer.">
        <Boton titulo="Eliminar mi cuenta" icono="papelera" variante="peligro" onPress={() => setEliminando(true)} />
      </Seccion>
      {eliminando ? <EliminarCuenta alCerrar={() => setEliminando(false)} /> : null}
    </ScrollView>
  );
}

const e = StyleSheet.create({ contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl } });
