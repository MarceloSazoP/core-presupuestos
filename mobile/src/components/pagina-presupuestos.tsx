import { FlashList } from '@shopify/flash-list';
import { PartesDeslizables } from '@/components/partes-deslizables';
import { avisar } from '@/lib/toast';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { OjoTonal } from '@/components/boton-ojo';
import { FilaPresupuesto } from '@/components/fila-presupuesto';
import { Icono } from '@/components/ui';
import { coincide } from '@/lib/buscar';
import type { EstadoElegible } from '@/lib/estados';
import { LISTA, useDinero } from '@/lib/montos';
import { alCambiar } from '@/lib/eventos';
import { avisarAceptado, cancelarRecordatorio, reconciliar, sincronizarRecordatorios } from '@/lib/notificaciones';
import { pushActivo } from '@/lib/push';
import { Pestanas } from '@/components/pestanas';
import { Sincronizacion } from '@/components/sincronizacion';
import { contar, PESTANAS, pestanaDe, type Pestana } from '@/lib/pestanas';
import { useRefrescar } from '@/lib/refrescar';
import { useSinSenal } from '@/lib/conexion';
import { creacionesPendientes, eliminacionesPendientes, eliminarPresupuesto, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, useTema } from '@/theme';

// La página de Presupuestos (index.tsx la pone junto a la de Inicio, bajo la misma barra): las pestañas por estado y la lista.
// - `alInicio`: deslizar hacia la derecha desde la primera pestaña vuelve a Inicio (la página anterior).
// - `abajo`: lo que tapa el botón de «Nuevo presupuesto»; la lista termina sobre él.
export function PaginaPresupuestos({ alInicio, abajo }: { alInicio: () => void; abajo: number }) {
  const t = useTema();
  const montoDe = useDinero(LISTA);
  const [lista, setLista] = useState<ResumenPresupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const [pestana, setPestana] = useState<Pestana>('pendientes');
  // Buscar mira todos los estados a la vez: nadie recuerda en qué pestaña quedó un presupuesto. Elegir una pestaña deja de buscar.
  const [busqueda, setBusqueda] = useState('');
  const buscando = busqueda.trim() !== '';
  const { pendientes } = useCola();
  const sinSenal = useSinSenal(); // sin señal lo explica el aviso de arriba: no se repite el error de carga en rojo
  const colaVacia = pendientes === 0;

  // El estado comercial de cada uno en la última lectura: si uno pasa a aceptado mientras se mira (el cliente lo aceptó desde su
  // correo), la lista se va a «Aceptados» si se estaba mirando la pestaña donde estaba y, sin push en este teléfono, se avisa aquí.
  const estadosAntes = useRef<Map<string, string> | null>(null);

  const cargar = useCallback(async () => {
    let base: ResumenPresupuesto[] | null = null;
    try {
      base = (await api<{ data: ResumenPresupuesto[] }>('/quotes?limit=100')).data;
      void guardarKv('lista', JSON.stringify(base));
      void reconciliar(base); // mantiene al día los recordatorios de contacto
      setError(null);
      const antes = estadosAntes.current;
      estadosAntes.current = new Map(base.map((q) => [q.id, q.commercial_status]));
      const aceptados = antes ? base.filter((q) => q.commercial_status === 'ACCEPTED' && antes.has(q.id) && antes.get(q.id) !== 'ACCEPTED') : [];
      if (aceptados.length) {
        const dejadas = new Set(aceptados.map((q) => pestanaDe({ doc_status: q.doc_status, commercial_status: antes!.get(q.id)! })));
        setPestana((p) => (dejadas.has(p) ? 'aceptados' : p));
        if (!pushActivo()) for (const q of aceptados) void avisarAceptado(q);
      }
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
      estadosAntes.current?.set(q.id, estado); // un cambio hecho aquí no se avisa como si lo hubiera hecho el cliente
      // Aceptar o rechazar cierra el seguimiento: el servidor borra el próximo contacto.
      const cierra = estado === 'ACCEPTED' || estado === 'REJECTED';
      setLista((l) => l && l.map((x) => (x.id === q.id ? { ...x, commercial_status: estado, next_contact_date: cierra ? null : x.next_contact_date } : x)));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void sincronizarRecordatorios();
    } catch (err) {
      avisar.error('No se pudo cambiar el estado', mensajeDe(err));
    }
  }, []);

  const elegirPestana = (p: Pestana) => {
    setBusqueda('');
    setPestana(p);
  };
  const cuentas = contar(lista ?? []);
  const visibles = (lista ?? []).filter((q) => (buscando ? coincide(q, busqueda) : pestanaDe(q) === pestana));
  const conBuscador = (lista?.length ?? 0) > 5 || buscando; // con pocos presupuestos se ven todos: el buscador sobraría
  // Lo que suman los de la pestaña, por moneda (si hubiera de más de un país, cada suma con la suya): «$2.206.422 en total».
  const sumas = new Map<string, number>();
  for (const q of visibles) if (q.total > 0) sumas.set(q.currency ?? 'CLP', (sumas.get(q.currency ?? 'CLP') ?? 0) + q.total);
  const enTotal = [...sumas].map(([moneda, n]) => montoDe(n, moneda)).join(' + ');

  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de crear o abrir uno, se actualiza (aunque se esté en Inicio)
  useEffect(() => void vaciar().then(cargar), [cargar, colaVacia]); // y al terminar de sincronizar
  useRefrescar(() => void cargar()); // y cuando cambia algo en la web
  useEffect(() => alCambiar(() => void cargar()), [cargar]); // y al instante, si llega el aviso de que un cliente aceptó

  // Deslizar a los lados, sobre la lista o sobre cualquier tarjeta, pasa a la pestaña de al lado (Pendientes ↔ Enviados ↔ …). Desde la
  // primera, hacia la derecha, vuelve a Inicio.
  const posicion = PESTANAS.findIndex((p) => p.id === pestana);
  const datos = PESTANAS[posicion]!;
  const irAPestana = (paso: number) => {
    const destino = PESTANAS[posicion + paso];
    if (!destino) return;
    void Haptics.selectionAsync();
    elegirPestana(destino.id);
  };
  const aInicio = (paso: number) => {
    if (paso > 0) return; // hacia la izquierda desde la última pestaña: no hay más
    void Haptics.selectionAsync();
    alInicio();
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
        // Cada presupuesto es su tarjeta, con espacio entre una y otra. Su margen a los lados lo pone la fila.
        renderItem={({ item }) => <FilaPresupuesto q={item} onEliminar={eliminar} onCambiarEstado={cambiarEstado} />}
        ItemSeparatorComponent={Separador}
        contentContainerStyle={{ paddingTop: espacio.l, paddingBottom: abajo + espacio.l }}
        keyboardShouldPersistTaps="handled" // con el teclado abierto, tocar un resultado lo abre al primer toque
        keyboardDismissMode="on-drag"
        refreshing={refrescando}
        onRefresh={async () => {
          setRefrescando(true);
          await cargar();
          setRefrescando(false);
        }}
        ListHeaderComponent={
          <View style={e.cabecera}>
            <Sincronizacion />
            {error && !sinSenal ? <Text variant="bodySmall" style={{ color: t.error }} accessibilityRole="alert">{error}</Text> : null}
            {conBuscador ? (
              <Searchbar
                placeholder="Buscar cliente, número o trabajo"
                value={busqueda}
                onChangeText={setBusqueda}
                icon={({ size, color }) => <Icono nombre="buscar" tamano={size} color={color} />}
                clearIcon={({ size, color }) => <Icono nombre="borrar" tamano={size} color={color} />}
                clearAccessibilityLabel="Borrar la búsqueda"
                autoCorrect={false}
                returnKeyType="search"
                elevation={0}
                style={[e.buscador, { backgroundColor: t.campo }]}
                inputStyle={e.textoBuscador}
              />
            ) : null}
            {/* Una línea con cuántos hay y cuánto suman (en Pendientes, cómo se elimina uno) y, al lado, el ojo que oculta los montos de la
                lista: igual que «Resumen» y su ojo en Inicio. La barra de arriba queda igual en las dos páginas. */}
            {visibles.length > 0 ? (
              <View style={e.resumen}>
                <View style={e.resumenTextos}>
                  <Text variant="bodyMedium" style={{ color: t.suave }}>
                    <Text style={[e.fuerte, { color: t.texto }]}>{buscando ? `${visibles.length} ${visibles.length === 1 ? 'resultado' : 'resultados'}` : datos.resumen(visibles.length)}</Text>
                    {buscando ? ' en todos los estados' : null}
                    {enTotal && !buscando ? (
                      <>
                        {' · '}
                        <Text style={e.cifra}>{enTotal}</Text> en total
                      </>
                    ) : null}
                  </Text>
                  {datos.ayuda && !buscando ? <Text variant="bodySmall" style={{ color: t.suave }}>{datos.ayuda}</Text> : null}
                </View>
                <OjoTonal clave={LISTA} />
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
              <Text variant="bodyMedium" style={[e.centrado, e.explicacion, { color: t.suave }]}>Cuando estés en una visita, toca el botón + de abajo: anota al cliente y el trabajo, y después sigue con fotos, medidas e ítems.</Text>
            </View>
          ) : buscando ? (
            <View style={e.vacio}>
              <View style={[e.vacioIcono, { backgroundColor: `${t.suave}${t.oscuro ? '24' : '1A'}` }]}>
                <Icono nombre="buscar" tamano={26} color={t.suave} />
              </View>
              <Text variant="titleMedium" style={[e.centrado, e.fuerte]}>Ninguno coincide con «{busqueda.trim()}»</Text>
              <Text variant="bodyMedium" style={[e.centrado, e.explicacion, { color: t.suave }]}>Busca por el nombre del cliente, el número del presupuesto o el trabajo.</Text>
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
    </View>
  );
}

const Separador = () => <View style={e.separador} />;

const e = StyleSheet.create({
  separador: { height: espacio.m }, // entre una tarjeta y otra
  // Lo de arriba de la lista, con el mismo espacio que entre las tarjetas.
  cabecera: { gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingLeft: espacio.xs },
  buscador: { borderRadius: 999 },
  textoBuscador: { fontSize: 16 }, // 16: el mínimo cómodo de leer (y el de la web, que no hace zoom)
  resumenTextos: { flex: 1, gap: 2 },
  fuerte: { fontWeight: '600' },
  cifra: { fontVariant: ['tabular-nums'] },
  cargando: { marginTop: espacio.xxl },
  vacio: { alignItems: 'center', gap: espacio.s, paddingTop: espacio.xxl * 2, paddingHorizontal: espacio.xl },
  vacioIcono: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: espacio.xs },
  centrado: { textAlign: 'center' },
  explicacion: { maxWidth: 300 },
});
