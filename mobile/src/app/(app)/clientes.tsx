import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Cliente } from '@/api/types';
import { FilaCliente } from '@/components/elegir-cliente';
import { BotonM } from '@/components/material';
import { AvisoSinSenal, Sincronizacion } from '@/components/sincronizacion';
import { Icono } from '@/components/ui';
import { coincideCliente } from '@/lib/buscar';
import { cargarClientes } from '@/lib/clientes';
import { useSinSenal } from '@/lib/conexion';
import { espacio, useTema } from '@/theme';

// Clientes (Arquitectura §5, «Clientes recurrentes y contactos»): los guardados, con un buscador por nombre o teléfono, y «Agregar cliente»
// a mano o desde Contactos. Tocar uno abre su ficha. Sin señal se ve la última lista guardada en el teléfono; agregar requiere internet.
export default function Clientes() {
  const t = useTema();
  const abajo = useSafeAreaInsets().bottom;
  const sinSenal = useSinSenal();
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const cargar = useCallback(async () => setLista((await cargarClientes()).lista), []);
  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de agregar o editar uno

  const buscando = busqueda.trim() !== '';
  const visibles = (lista ?? []).filter((c) => !buscando || coincideCliente(c, busqueda));
  return (
    <View style={[e.flex, { backgroundColor: t.fondo }]}>
      <FlashList
        data={visibles}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <FilaCliente c={item} alTocar={() => router.push({ pathname: '/cliente/[id]', params: { id: item.id } })} />}
        ItemSeparatorComponent={() => <View style={[e.separador, { backgroundColor: t.borde }]} />}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: abajo + espacio.xl }}
        refreshing={refrescando}
        onRefresh={async () => {
          setRefrescando(true);
          await cargar();
          setRefrescando(false);
        }}
        ListHeaderComponent={
          <View style={e.cabecera}>
            <Sincronizacion />
            <BotonM titulo="Agregar cliente" icono="mas" onPress={() => router.push('/cliente-editar')} disabled={sinSenal} />
            {sinSenal ? <AvisoSinSenal texto="para agregar un cliente, necesitas internet. Igual puedes crear un presupuesto con uno nuevo." /> : null}
            {(lista?.length ?? 0) > 0 ? (
              <Searchbar
                placeholder="Buscar por nombre o teléfono"
                value={busqueda}
                onChangeText={setBusqueda}
                icon={({ size, color }) => <Icono nombre="buscar" tamano={size} color={color} />}
                clearIcon={({ size, color }) => <Icono nombre="borrar" tamano={size} color={color} />}
                clearAccessibilityLabel="Borrar la búsqueda"
                autoCorrect={false}
                elevation={0}
                style={[e.buscador, { backgroundColor: t.campo }]}
                inputStyle={e.textoBuscador}
              />
            ) : null}
            {visibles.length > 0 ? (
              <Text variant="bodyMedium" style={{ color: t.suave }}>
                {buscando ? `${visibles.length} ${visibles.length === 1 ? 'resultado' : 'resultados'}` : `${visibles.length} ${visibles.length === 1 ? 'cliente' : 'clientes'}`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <ActivityIndicator color={t.acento} style={e.cargando} />
          ) : (
            <View style={e.vacio}>
              <View style={[e.vacioIcono, { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1A'}` }]}>
                <Icono nombre={buscando ? 'buscar' : 'clientes'} tamano={26} color={t.acento} />
              </View>
              <Text variant="titleMedium" style={[e.centrado, e.fuerte]}>{buscando ? `Ninguno coincide con «${busqueda.trim()}»` : 'Aún no tienes clientes'}</Text>
              <Text variant="bodyMedium" style={[e.centrado, e.explicacion, { color: t.suave }]}>
                {buscando ? 'Busca por el nombre o por parte del teléfono.' : 'Se guardan solos al crear un presupuesto. También puedes agregarlos aquí, a mano o desde tus contactos.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const e = StyleSheet.create({
  flex: { flex: 1 },
  cabecera: { gap: espacio.m, padding: espacio.l },
  buscador: { borderRadius: 999 },
  textoBuscador: { fontSize: 16 },
  separador: { height: StyleSheet.hairlineWidth, marginLeft: espacio.l + 44 + espacio.l }, // la línea empieza donde el texto, no bajo el círculo
  cargando: { marginTop: espacio.xxl },
  vacio: { alignItems: 'center', gap: espacio.s, paddingTop: espacio.xxl, paddingHorizontal: espacio.xl },
  vacioIcono: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: espacio.xs },
  centrado: { textAlign: 'center' },
  fuerte: { fontWeight: '600' },
  explicacion: { maxWidth: 300 },
});
