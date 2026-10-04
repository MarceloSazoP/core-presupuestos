import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, mensajeDe } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { FilaPresupuesto } from '@/components/fila-presupuesto';
import { Boton, Texto } from '@/components/ui';
import { cancelarRecordatorio, reconciliar } from '@/lib/notificaciones';
import { Pestanas } from '@/components/pestanas';
import { Sincronizacion } from '@/components/sincronizacion';
import { contar, PESTANAS, pestanaDe, type Pestana } from '@/lib/pestanas';
import { creacionesPendientes, eliminacionesPendientes, eliminarPresupuesto, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

export default function Presupuestos() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [lista, setLista] = useState<ResumenPresupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const { pendientes } = useCola();
  const colaVacia = pendientes === 0;

  const cargar = useCallback(async () => {
    let base: ResumenPresupuesto[] | null = null;
    try {
      base = (await api<{ data: ResumenPresupuesto[] }>('/quotes?limit=100')).data;
      void guardarKv('lista', JSON.stringify(base));
      void reconciliar(base); // mantiene al día los recordatorios de contacto
      setError(null);
    } catch (err) {
      setError(mensajeDe(err)); // sin señal en terreno se muestra la última lista guardada
      base = JSON.parse((await leerKv('lista')) ?? 'null') as ResumenPresupuesto[] | null;
    }
    // Lo que se eliminó pero el servidor aún no borró (sin conexión) no se muestra.
    const eliminados = await eliminacionesPendientes();
    base = base && base.filter((r) => !eliminados.has(r.id));
    // Los presupuestos creados sin conexión aparecen arriba hasta que el servidor los reciba.
    const nuevos: ResumenPresupuesto[] = [];
    for (const id of await creacionesPendientes()) {
      const b = await leerBorrador(id);
      if (b && !eliminados.has(id) && !base?.some((r) => r.id === id)) nuevos.push({ id, code_id: b.code_id || undefined, number: null, customer: { id: b.customer.id, name: b.customer.name }, service_description: b.service_description, total: 0, doc_status: 'DRAFT', commercial_status: 'NONE', next_contact_date: null, updated_at: '' });
    }
    setLista(base || nuevos.length ? [...nuevos, ...(base ?? [])] : base);
  }, []);

  const eliminar = useCallback(async (q: ResumenPresupuesto) => {
    setLista((l) => l && l.filter((x) => x.id !== q.id)); // desaparece al instante; el borrado viaja por la cola
    await eliminarPresupuesto(q.id);
    void cancelarRecordatorio(q.id);
  }, []);

  // La última pestaña vista se recuerda.
  useEffect(() => void leerKv('pestana').then((p) => PESTANAS.some((x) => x.id === p) && setPestana(p as Pestana)), []);
  const elegirPestana = (p: Pestana) => {
    setPestana(p);
    void guardarKv('pestana', p);
  };
  const cuentas = contar(lista ?? []);
  const visibles = (lista ?? []).filter((q) => pestanaDe(q) === pestana);

  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de crear o abrir uno, se actualiza
  useEffect(() => void vaciar().then(cargar), [cargar, colaVacia]); // y al terminar de sincronizar

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <Pestanas activa={pestana} cuentas={cuentas} alElegir={elegirPestana} />
      <FlashList
        data={visibles}
        keyExtractor={(q) => q.id}
        renderItem={({ item }) => <FilaPresupuesto q={item} onEliminar={eliminar} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: espacio.l, paddingBottom: insets.bottom + MIN_TOQUE + espacio.xxl }}
        ItemSeparatorComponent={Separador}
        refreshing={refrescando}
        onRefresh={async () => {
          setRefrescando(true);
          await cargar();
          setRefrescando(false);
        }}
        ListHeaderComponent={
          <View style={e.aviso}>
            <Sincronizacion />
            {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <ActivityIndicator style={e.cargando} color={t.suave} />
          ) : lista.length === 0 ? (
            <View style={e.vacio}>
              <Texto variante="subtitulo">Aún no tienes presupuestos</Texto>
              <Texto suave>Cuando estés en una visita, toca «Nuevo presupuesto»: anota al cliente y el trabajo, y después sigue con fotos, medidas e ítems.</Texto>
            </View>
          ) : (
            <View style={e.vacio}>
              <Texto variante="subtitulo">Nada en {PESTANAS.find((p) => p.id === pestana)!.texto.toLowerCase()}</Texto>
              <Texto suave>{PESTANAS.find((p) => p.id === pestana)!.vacio}</Texto>
            </View>
          )
        }
      />
      {/* Acción principal en la zona del pulgar (tercio inferior) */}
      <View pointerEvents="box-none" style={[e.cta, { paddingBottom: insets.bottom + espacio.m }]}>
        <Boton titulo="+ Nuevo presupuesto" onPress={() => router.push('/nuevo')} style={e.ctaBoton} />
      </View>
    </View>
  );
}

const Separador = () => <View style={{ height: espacio.m }} />;

const e = StyleSheet.create({
  aviso: { gap: espacio.s, paddingBottom: espacio.m },
  cargando: { marginTop: espacio.xxl },
  vacio: { gap: espacio.s, paddingTop: espacio.xxl },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: espacio.l },
  ctaBoton: { boxShadow: '0 6px 20px rgba(29, 78, 216, 0.35)' },
});
