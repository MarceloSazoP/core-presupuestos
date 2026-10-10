import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import type { ClienteDetalle, ResumenPresupuesto } from '@/api/types';
import { useDialogo } from '@/components/dialogo';
import { FilaPresupuesto } from '@/components/fila-presupuesto';
import { BotonM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { AvisoSinSenal, Sincronizacion } from '@/components/sincronizacion';
import { Icono } from '@/components/ui';
import { cargarClientes, iniciales, telefonoLegible } from '@/lib/clientes';
import { useSinSenal } from '@/lib/conexion';
import { avisar } from '@/lib/toast';
import { leerKv } from '@/sync/db';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Ficha del cliente (Arquitectura §5): quién es, cuánto ha trabajado contigo (presupuestos, aceptados, en seguimiento), las acciones de
// siempre a la vista (llamar, WhatsApp y un presupuesto nuevo para él) y sus presupuestos. Arriba a la derecha, editar sus datos; al pie,
// eliminarlo, solo si no tiene presupuestos. Sin señal se ve lo guardado en el teléfono.
export default function FichaCliente() {
  const t = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sinSenal = useSinSenal();
  const { dialogo, decidir } = useDialogo();
  const [c, setC] = useState<(ClienteDetalle & { guardado?: boolean }) | null>(null);
  const [presupuestos, setPresupuestos] = useState<ResumenPresupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [cliente, lista] = await Promise.all([api<ClienteDetalle>(`/customers/${id}`), api<{ data: ResumenPresupuesto[] }>(`/quotes?customer_id=${id}&limit=100`)]);
      setC(cliente);
      setPresupuestos(lista.data);
      setError(null);
    } catch (err) {
      // Sin señal: el cliente de la lista guardada y sus presupuestos de la última lista vista (sin el resumen del servidor).
      const guardado = (await cargarClientes()).lista.find((x) => x.id === id);
      const ultima = (JSON.parse((await leerKv('lista')) ?? '[]') as ResumenPresupuesto[] | null) ?? [];
      if (guardado) {
        const suyos = ultima.filter((q) => q.customer.id === id);
        setC({ ...guardado, summary: { quotes: suyos.length, accepted: suyos.filter((q) => q.commercial_status === 'ACCEPTED').length, follow_up: suyos.filter((q) => q.commercial_status === 'FOLLOW_UP').length }, guardado: true });
        setPresupuestos(suyos);
      } else setError(mensajeDe(err));
    }
  }, [id]);
  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de editarlo o de uno de sus presupuestos

  if (!c) {
    return <View style={[e.centro, { backgroundColor: t.fondo }]}>{error ? <TextoM color="error" accessibilityRole="alert">{error}</TextoM> : <ActivityIndicator color={t.acento} />}</View>;
  }

  const tel = c.phone.replace(/\D/g, '');
  const eliminar = () =>
    decidir(`¿Eliminar a ${c.name}?`, 'Se borran sus datos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void api(`/customers/${c.id}`, { method: 'DELETE' })
            .then(() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              avisar.exito('Cliente eliminado');
              router.back();
            })
            .catch((err) => avisar.error('No se pudo eliminar', mensajeDe(err))),
      },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Stack.Screen
        options={{
          title: c.name,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Editar los datos del cliente" disabled={sinSenal} hitSlop={6} onPress={() => router.push({ pathname: '/cliente-editar', params: { id: c.id } })} style={[e.cabeceraBoton, { opacity: sinSenal ? 0.4 : 1 }]}>
              <Icono nombre="lapiz" tamano={22} color={t.acento} />
            </Pressable>
          ),
        }}
      />
      <Sincronizacion />

      {/* Quién es: el círculo con sus iniciales, el nombre grande y cómo ubicarlo. */}
      <TarjetaM>
        <View style={e.quien}>
          <View style={[e.circulo, { backgroundColor: `${t.acento}${t.oscuro ? '33' : '1F'}` }]}>
            <Text variant="headlineSmall" style={{ color: t.acento }}>{iniciales(c.name)}</Text>
          </View>
          <View style={e.flex}>
            <Text variant="titleLarge" accessibilityRole="header" style={e.fuerte}>{c.name}</Text>
            <TextoM suave style={e.cifra}>{telefonoLegible(c.phone)}</TextoM>
            {c.email ? <TextoM suave selectable>{c.email}</TextoM> : null}
            {c.address ? <TextoM suave selectable>{c.address}</TextoM> : null}
          </View>
        </View>
        {/* Cuánto ha trabajado contigo, en tres cifras. */}
        <View style={[e.cifras, { borderTopColor: t.borde }]}>
          <Cifra valor={c.summary.quotes} etiqueta={c.summary.quotes === 1 ? 'Presupuesto' : 'Presupuestos'} />
          <Cifra valor={c.summary.accepted} etiqueta={c.summary.accepted === 1 ? 'Aceptado' : 'Aceptados'} color="info" />
          <Cifra valor={c.summary.follow_up} etiqueta="En seguimiento" color="seguimiento" />
        </View>
      </TarjetaM>

      <View style={e.fila}>
        <BotonM titulo="Llamar" icono="llamar" variante="secundario" onPress={() => void Linking.openURL(`tel:${c.phone}`)} style={e.mitad} />
        <BotonM titulo="WhatsApp" icono="mensaje" variante="secundario" onPress={() => void Linking.openURL(`https://wa.me/${tel}`)} disabled={sinSenal} style={e.mitad} />
      </View>
      <BotonM titulo="Nuevo presupuesto para este cliente" icono="mas" onPress={() => router.push({ pathname: '/nuevo', params: { cliente: c.id } })} />

      <SeccionM titulo="Sus presupuestos" icono="documento">
        {presupuestos === null ? (
          <ActivityIndicator color={t.acento} />
        ) : presupuestos.length ? (
          <View style={e.lista}>
            {presupuestos.map((q) => (
              <FilaPresupuesto key={q.id} q={q} sinCliente />
            ))}
          </View>
        ) : (
          <TextoM suave>Todavía no tiene presupuestos.</TextoM>
        )}
      </SeccionM>

      {/* Eliminar solo se ofrece sin presupuestos: con presupuestos el servidor lo rechaza (Contrato API §5). */}
      {c.summary.quotes === 0 && !c.guardado ? (
        <>
          <BotonM titulo="Eliminar cliente" icono="papelera" variante="texto" onPress={eliminar} disabled={sinSenal} />
          {sinSenal ? <AvisoSinSenal texto="para eliminarlo, necesitas internet." /> : null}
        </>
      ) : null}
      {dialogo}
    </ScrollView>
  );
}

function Cifra({ valor, etiqueta, color }: { valor: number; etiqueta: string; color?: 'info' | 'seguimiento' }) {
  return (
    <View style={e.cifraCaja} accessible accessibilityLabel={`${valor} ${etiqueta}`}>
      <TextoM variante="titulo" color={color} style={e.cifra}>{valor}</TextoM>
      <TextoM variante="chico" suave>{etiqueta}</TextoM>
    </View>
  );
}

const e = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.l },
  cabeceraBoton: { minWidth: MIN_TOQUE - 8, minHeight: MIN_TOQUE - 8, alignItems: 'center', justifyContent: 'center' },
  quien: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  circulo: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  fuerte: { fontWeight: '600' },
  cifra: { fontVariant: ['tabular-nums'] },
  cifras: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espacio.m },
  cifraCaja: { flex: 1, gap: 2 },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  lista: { gap: espacio.m, marginHorizontal: -espacio.l }, // la fila de presupuesto trae su propio margen a los lados
});
