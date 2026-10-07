import { FlashList } from '@shopify/flash-list';
import { PartesDeslizables } from '@/components/partes-deslizables';
import { avisar } from '@/lib/toast';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, mensajeDe } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { formaPanel } from '@/components/barra-flotante';
import { FilaPresupuesto } from '@/components/fila-presupuesto';
import { BotonM } from '@/components/material';
import { Icono } from '@/components/ui';
import type { EstadoElegible } from '@/lib/estados';
import { LISTA, useDinero } from '@/lib/montos';
import { cancelarRecordatorio, reconciliar, sincronizarRecordatorios } from '@/lib/notificaciones';
import { Pestanas } from '@/components/pestanas';
import { Sincronizacion } from '@/components/sincronizacion';
import { contar, PESTANAS, pestanaDe, type Pestana } from '@/lib/pestanas';
import { useRefrescar } from '@/lib/refrescar';
import { creacionesPendientes, eliminacionesPendientes, eliminarPresupuesto, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, useTema } from '@/theme';

// El panel de abajo: el botón de Material (52) con espacio.m arriba y abajo, más la franja del indicador de inicio o de los botones de Android.
const ALTO_BOTON = 52;

export default function ListaPresupuestos() {
  const t = useTema();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const montoDe = useDinero(LISTA);
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
  // Lo que suman los de la pestaña, por moneda (si hubiera de más de un país, cada suma con la suya): «$2.206.422 en total».
  const sumas = new Map<string, number>();
  for (const q of visibles) if (q.total > 0) sumas.set(q.currency ?? 'CLP', (sumas.get(q.currency ?? 'CLP') ?? 0) + q.total);
  const enTotal = [...sumas].map(([moneda, n]) => montoDe(n, moneda)).join(' + ');

  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de crear o abrir uno, se actualiza
  useEffect(() => void vaciar().then(cargar), [cargar, colaVacia]); // y al terminar de sincronizar
  useRefrescar(() => void cargar()); // y cuando cambia algo en la web

  // Deslizar a los lados, sobre la lista o sobre cualquier tarjeta, pasa a la pestaña de al lado (Pendientes ↔ Enviados ↔ …). Desde la
  // primera, hacia la derecha, vuelve a Inicio.
  const posicion = PESTANAS.findIndex((p) => p.id === pestana);
  const datos = PESTANAS[posicion]!;
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
        extraData={visibles.length} // la última fila cambia (sus esquinas) al eliminar otra
        keyExtractor={(q) => q.id}
        // Las filas forman una sola tarjeta: cada una sabe si es la primera o la última. Su margen a los lados lo pone la fila (es donde cae su sombra).
        renderItem={({ item, index }) => <FilaPresupuesto q={item} primero={index === 0} ultimo={index === visibles.length - 1} onEliminar={eliminar} onCambiarEstado={cambiarEstado} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: espacio.l, paddingBottom: insets.bottom + ALTO_BOTON + espacio.m * 2 + espacio.s }}
        refreshing={refrescando}
        onRefresh={async () => {
          setRefrescando(true);
          await cargar();
          setRefrescando(false);
        }}
        ListHeaderComponent={
          <View style={e.cabecera}>
            <Sincronizacion />
            {error ? <Text variant="bodySmall" style={{ color: t.error }} accessibilityRole="alert">{error}</Text> : null}
            {/* Una línea con cuántos hay y cuánto suman; en Pendientes, cómo se elimina uno. */}
            {visibles.length > 0 ? (
              <View style={e.resumen}>
                <Text variant="bodyMedium" style={{ color: t.suave }}>
                  <Text style={[e.fuerte, { color: t.texto }]}>{datos.resumen(visibles.length)}</Text>
                  {enTotal ? (
                    <>
                      {' · '}
                      <Text style={e.cifra}>{enTotal}</Text> en total
                    </>
                  ) : null}
                </Text>
                {datos.ayuda ? <Text variant="bodySmall" style={{ color: t.suave }}>{datos.ayuda}</Text> : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <ActivityIndicator style={e.cargando} color={t.acento} />
          ) : lista.length === 0 ? (
            <View style={e.vacio}>
              <View style={[e.vacioIcono, { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1A'}` }]}>
                <Icono nombre="documento" tamano={26} color={t.acento} />
              </View>
              <Text variant="titleMedium" style={[e.centrado, e.fuerte]}>Aún no tienes presupuestos</Text>
              <Text variant="bodyMedium" style={[e.centrado, e.explicacion, { color: t.suave }]}>Cuando estés en una visita, toca «Nuevo presupuesto»: anota al cliente y el trabajo, y después sigue con fotos, medidas e ítems.</Text>
            </View>
          ) : (
            <View style={e.vacio}>
              <View style={[e.vacioIcono, { backgroundColor: `${t.suave}${t.oscuro ? '24' : '1A'}` }]}>
                <Icono nombre="documento" tamano={26} color={t.suave} />
              </View>
              <Text variant="titleMedium" style={[e.centrado, e.fuerte]}>Nada en {datos.texto.toLowerCase()}</Text>
              <Text variant="bodyMedium" style={[e.centrado, e.explicacion, { color: t.suave }]}>{datos.vacio}</Text>
            </View>
          )
        }
      />
      </PartesDeslizables>
      {/* Acción principal en la zona del pulgar (tercio inferior), en un panel propio como la barra del presupuesto: la superficie de nivel 2
          con la sombra hacia arriba, hasta el borde de la pantalla. La lista pasa por debajo sin mezclarse con el botón. */}
      <View style={[e.panel, formaPanel(t.oscuro), { backgroundColor: colors.elevation.level2, paddingBottom: insets.bottom + espacio.m }]}>
        <BotonM titulo="Nuevo presupuesto" icono="mas" onPress={() => router.push('/nuevo')} />
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  // Lo de arriba de la lista. Abajo deja espacio.xs: la primera fila trae otros espacio.s para su sombra.
  cabecera: { gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.xs },
  resumen: { gap: 2, paddingHorizontal: espacio.xs },
  fuerte: { fontWeight: '600' },
  cifra: { fontVariant: ['tabular-nums'] },
  cargando: { marginTop: espacio.xxl },
  vacio: { alignItems: 'center', gap: espacio.s, paddingTop: espacio.xxl * 2, paddingHorizontal: espacio.xl },
  vacioIcono: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: espacio.xs },
  centrado: { textAlign: 'center' },
  explicacion: { maxWidth: 300 },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: espacio.m, paddingHorizontal: espacio.l },
});
