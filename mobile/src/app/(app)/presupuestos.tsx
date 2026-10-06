import { FlashList } from '@shopify/flash-list';
import { PartesDeslizables } from '@/components/partes-deslizables';
import { avisar } from '@/lib/toast';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, mensajeDe } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { FilaPresupuesto } from '@/components/fila-presupuesto';
import { Boton, Icono, Texto } from '@/components/ui';
import type { EstadoElegible } from '@/lib/estados';
import { cancelarRecordatorio, reconciliar, sincronizarRecordatorios } from '@/lib/notificaciones';
import { Pestanas } from '@/components/pestanas';
import { Sincronizacion } from '@/components/sincronizacion';
import { contar, PESTANAS, pestanaDe, type Pestana } from '@/lib/pestanas';
import { useRefrescar } from '@/lib/refrescar';
import { creacionesPendientes, eliminacionesPendientes, eliminarPresupuesto, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

export default function ListaPresupuestos() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [lista, setLista] = useState<ResumenPresupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const { pestana: pedida } = useLocalSearchParams<{ pestana?: string }>(); // el menú del inicio abre directo en su estado
  const [pestana, setPestana] = useState<Pestana>(PESTANAS.some((x) => x.id === pedida) ? (pedida as Pestana) : 'pendientes');
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

  // Cambio manual de estado (Contrato API §8). Necesita conexión: si falla, la fila queda como estaba y se avisa.
  const cambiarEstado = useCallback(async (q: ResumenPresupuesto, estado: EstadoElegible) => {
    try {
      await api(`/quotes/${q.id}/commercial-status`, { method: 'PUT', body: { status: estado } });
      // Aceptar o rechazar cierra el seguimiento: el servidor borra el próximo contacto.
      const cierra = estado === 'ACCEPTED' || estado === 'REJECTED';
      setLista((l) => l && l.map((x) => (x.id === q.id ? { ...x, commercial_status: estado, next_contact_date: cierra ? null : x.next_contact_date } : x)));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void sincronizarRecordatorios();
    } catch (err) {
      avisar.error('No se pudo cambiar el estado', mensajeDe(err));
    }
  }, []);

  // Siempre se abre en «Pendientes» (o en la pestaña que pida quien navega aquí): ya no se recuerda la última que se vio.
  const elegirPestana = setPestana;
  const cuentas = contar(lista ?? []);
  const visibles = (lista ?? []).filter((q) => pestanaDe(q) === pestana);

  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de crear o abrir uno, se actualiza
  useEffect(() => void vaciar().then(cargar), [cargar, colaVacia]); // y al terminar de sincronizar
  useRefrescar(() => void cargar()); // y cuando cambia algo en la web

  // Deslizar a los lados, sobre la lista o sobre cualquier tarjeta, pasa a la pestaña de al lado (Pendientes ↔ Enviados ↔ …). Desde la
  // primera, hacia la derecha, vuelve a Inicio.
  const posicion = PESTANAS.findIndex((p) => p.id === pestana);
  const irAPestana = (paso: number) => {
    const destino = PESTANAS[posicion + paso];
    if (!destino) return;
    void Haptics.selectionAsync();
    setPestana(destino.id);
  };
  const aInicio = (paso: number) => {
    if (paso > 0) return; // hacia la izquierda desde la última pestaña: no hay más
    void Haptics.selectionAsync();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <Pestanas activa={pestana} cuentas={cuentas} alElegir={elegirPestana} />
      <PartesDeslizables posicion={posicion} total={PESTANAS.length} alIr={irAPestana} alBorde={aInicio} estilo={{ flex: 1 }}>
      <FlashList
        key={pestana} // al cambiar de pestaña la lista parte desde arriba
        // FlashList 2 conserva por defecto lo que ya se veía cuando llegan elementos arriba: los presupuestos nuevos quedaban
        // por encima de la pantalla, escondidos detrás de las pestañas. Aquí lo nuevo debe verse primero.
        maintainVisibleContentPosition={{ disabled: true }}
        data={visibles}
        keyExtractor={(q) => q.id}
        renderItem={({ item }) => <FilaPresupuesto q={item} onEliminar={eliminar} onCambiarEstado={cambiarEstado} />}
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
            {/* La glosa de la pestaña: qué contiene y si se pueden eliminar (y cómo). */}
            <View style={[e.glosa, { backgroundColor: `${t.acento}0F`, borderColor: t.borde }]}>
              <Icono nombre="info" tamano={18} color={t.acento} />
              <View style={e.glosaTextos}>
                <Texto variante="chico">{PESTANAS[posicion]!.glosa}</Texto>
                <Texto variante="chico" suave>{PESTANAS[posicion]!.eliminar}</Texto>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <ActivityIndicator style={e.cargando} color={t.suave} />
          ) : lista.length === 0 ? (
            <View style={e.vacio}>
              <View style={[e.vacioIcono, { backgroundColor: `${t.acento}1A` }]}>
                <Icono nombre="documento" tamano={30} color={t.acento} />
              </View>
              <Texto variante="subtitulo" style={e.centrado}>Aún no tienes presupuestos</Texto>
              <Texto suave style={e.centrado}>Cuando estés en una visita, toca «Nuevo presupuesto»: anota al cliente y el trabajo, y después sigue con fotos, medidas e ítems.</Texto>
            </View>
          ) : (
            <View style={e.vacio}>
              <View style={[e.vacioIcono, { backgroundColor: `${t.suave}1A` }]}>
                <Icono nombre="documento" tamano={30} color={t.suave} />
              </View>
              <Texto variante="subtitulo" style={e.centrado}>Nada en {PESTANAS.find((p) => p.id === pestana)!.texto.toLowerCase()}</Texto>
              <Texto suave style={e.centrado}>{PESTANAS.find((p) => p.id === pestana)!.vacio}</Texto>
            </View>
          )
        }
      />
      </PartesDeslizables>
      {/* Acción principal en la zona del pulgar (tercio inferior) */}
      <View pointerEvents="box-none" style={[e.cta, { paddingBottom: insets.bottom + espacio.m }]}>
        <Boton titulo="Nuevo presupuesto" icono="mas" onPress={() => router.push('/nuevo')} />
      </View>
    </View>
  );
}

const Separador = () => <View style={{ height: espacio.m }} />;

const e = StyleSheet.create({
  glosa: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.m },
  glosaTextos: { flex: 1, gap: 2 },
  aviso: { gap: espacio.s, paddingBottom: espacio.m },
  cargando: { marginTop: espacio.xxl },
  vacio: { alignItems: 'center', gap: espacio.s, paddingTop: espacio.xxl * 2, paddingHorizontal: espacio.xl },
  vacioIcono: { width: 64, height: 64, borderRadius: radio.l, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginBottom: espacio.s },
  centrado: { textAlign: 'center' },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: espacio.l },
});
