import * as Haptics from 'expo-haptics';
import { cancelarRecordatorio } from '@/lib/notificaciones';
import { IconoDinero } from '@/components/icono-dinero';
import { BotonOjo } from '@/components/boton-ojo';
import { delPresupuesto, useDinero } from '@/lib/montos';
import { ScrollConBarra } from '@/components/barra-flotante';
import { avisar } from '@/lib/toast';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { simboloUnidad } from '@/lib/unidades';
import { useCallback, useEffect, useRef, useState } from 'react';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Cierre, Envio } from '@/components/cierre';
import { EditarCliente, TarjetaCliente, TituloPresupuesto } from '@/components/contacto-cliente';
import { useDialogo } from '@/components/dialogo';
import { Seguimiento } from '@/components/seguimiento';
import { Levantamiento } from '@/components/levantamiento';
import { NuevaVersion } from '@/components/nueva-version';
import { PartesDeslizables } from '@/components/partes-deslizables';
import { AccionesCerrado, ResumenCerrado, VisitaLectura } from '@/components/resumen-cerrado';
import { Sincronizacion } from '@/components/sincronizacion';
import { BotonM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { PestanasParte } from '@/components/pestanas-parte';
import { huellaCierre, huellaLevantamiento } from '@/lib/huellas';
import { useRefrescar } from '@/lib/refrescar';
import { eliminarPresupuesto, guardarBorrador, hayPendientesDe, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Detalle del presupuesto. Lo central de este hito: el código que se escribe en la web para completar o cerrar el
// presupuesto desde el computador (CLAUDE.md §16). Se muestra con letras grandes y se copia o comparte con un toque.
export default function Detalle() {
  const t = useTema();
  const { dialogo, decidir } = useDialogo();
  const { id, nuevo } = useLocalSearchParams<{ id: string; nuevo?: string }>();
  const montoDe = useDinero(delPresupuesto(id));
  const [q, setQ] = useState<Presupuesto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editandoCliente, setEditandoCliente] = useState(false);
  // Al llegar desde «Nuevo presupuesto», un aviso desde arriba en vez de un recuadro fijo en la pantalla.
  useEffect(() => {
    if (nuevo === '1') avisar.exito('Presupuesto creado', 'Sigue con la visita y después arma el precio. El código para abrirlo en la web está en el ícono QR.');
  }, [nuevo]);
  const [parte, setParte] = useState<string | null>(null); // pestaña elegida; null = la primera de su estado
  const [vista, setVista] = useState({ cierre: 0, levantamiento: 0 }); // sube cuando el servidor trae cambios de otro lugar (la web)
  const actual = useRef<Presupuesto | null>(null);
  useEffect(() => {
    actual.current = q;
  }, [q]);

  const { pendientes } = useCola();
  const colaVacia = pendientes === 0;

  // La pantalla trabaja sobre la copia local (q); el servidor la reemplaza solo cuando no quedan cambios sin enviar.
  const recargar = useCallback(async () => {
    await vaciar();
    try {
      const servidor = await api<Presupuesto>(`/quotes/${id}`);
      if (!(await hayPendientesDe(id))) {
        const local = actual.current;
        if (local) setVista((v) => ({ cierre: v.cierre + Number(huellaCierre(local) !== huellaCierre(servidor)), levantamiento: v.levantamiento + Number(huellaLevantamiento(local) !== huellaLevantamiento(servidor)) }));
        setQ(servidor);
      }
    } catch (err) {
      setError(mensajeDe(err)); // sin conexión se sigue con la copia local, si la hay
    }
  }, [id]);

  useRefrescar(() => void recargar()); // cambios hechos en la web aparecen aquí sin salir de la pantalla

  const cambiar = useCallback((f: (p: Presupuesto) => Presupuesto) => setQ((p) => (p ? f(p) : p)), []);

  useEffect(() => {
    void leerBorrador(id).then((b) => b && setQ((actual) => actual ?? b));
    void vaciar().then(recargar);
  }, [id, recargar, colaVacia]); // al vaciarse la cola se trae la versión del servidor (con las fotos ya subidas)

  useEffect(() => {
    if (q) void guardarBorrador(q);
  }, [q]);

  // Al terminar el presupuesto desde esta pantalla, la tarjeta de envío entra con un asentado suave (no al abrir uno ya cerrado).
  const [recienTerminado, setRecienTerminado] = useState(false);

  if (!q) {
    return (
      <View style={[e.centro, { backgroundColor: t.fondo }]}>
        {error ? <TextoM color="error" accessibilityRole="alert">{error}</TextoM> : <ActivityIndicator color={t.acento} />}
      </View>
    );
  }

  const cerrado = q.doc_status === 'FINALIZED';
  // «⋯» de la barra: las opciones en el diálogo de Material (en vez de un menú anclado, que en la barra nativa se ubica distinto en iPhone y
  // Android). Eliminar pide su propia confirmación después.
  const masOpciones = () =>
    decidir(`Presupuesto de ${q.customer.name}`, undefined, [
      { text: 'Datos del cliente', onPress: () => setEditandoCliente(true) },
      ...(!cerrado ? [{ text: 'Eliminar presupuesto', style: 'destructive' as const, onPress: eliminarEste }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  const eliminarEste = () =>
    decidir(`¿Eliminar el presupuesto de ${q.customer.name}?`, 'Se borran también sus fotos, notas de voz y notas. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void eliminarPresupuesto(id);
          void cancelarRecordatorio(id);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          avisar.exito('Presupuesto eliminado');
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: '/', params: { pagina: 'presupuestos' } });
        },
      },
    ]);

  // Qué pestañas tiene: uno pendiente se trabaja en dos partes; uno cerrado se envía, se le hace seguimiento y se revisa.
  const partes = cerrado
    ? [{ id: 'enviar', texto: 'Enviar', icono: 'enviar' as const }, ...(q.commercial_status !== 'NONE' ? [{ id: 'seguimiento', texto: 'Seguimiento', icono: 'reloj' as const }] : []), { id: 'detalle', texto: 'Detalle', icono: 'lista' as const }]
    : [{ id: 'visita', texto: 'Visita', icono: 'ubicacion' as const }, { id: 'presupuesto', texto: 'Presupuesto', icono: 'documento' as const }];
  const actualId = partes.some((x) => x.id === parte) ? parte! : partes[0]!.id;
  // Las partes de un presupuesto pendiente se quedan montadas aunque no se vean: lo que se está escribiendo no se pierde al cambiar.
  const oculta = (id: string) => (actualId === id ? null : e.oculta);
  // Deslizar a los lados cambia de parte (el movimiento vive en PartesDeslizables).
  const posicion = partes.findIndex((x) => x.id === actualId);
  const ir = (paso: number) => {
    const destino = partes[posicion + paso];
    if (!destino) return;
    void Haptics.selectionAsync();
    setParte(destino.id);
  };

  return (
    <ScrollConBarra contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Stack.Screen
        options={{
          title: 'Presupuesto',
          gestureEnabled: false, // el deslizar es para cambiar de parte: el gesto nativo de «volver» lo pisaba y dejaba la pantalla por error (se vuelve con el botón de la barra)
          // Volver es solo la flecha (sin «Atrás»): deja espacio al título.
          headerBackButtonDisplayMode: 'minimal',
          headerTitle: () => <TituloPresupuesto q={q} />,
          // A la derecha, el QR para abrirlo en la web y «⋯» con lo demás: los datos del cliente y, si está pendiente, eliminarlo (los
          // terminados no se eliminan, Contrato API §6; siempre con confirmación). Lo destructivo va en el menú, no a la vista.
          headerRight: () => (
            <View style={e.accionesCabecera}>
              <Pressable accessibilityRole="button" accessibilityLabel="Código y QR para abrirlo en la web" hitSlop={6} onPress={() => router.push({ pathname: '/codigo', params: { id, titulo: `${q.number ?? 'Presupuesto'} de ${q.customer.name}`, ...(q.code_id ? { codeId: q.code_id } : {}) } })} style={e.cabeceraBoton}>
                <Icono nombre="qr" tamano={22} color={t.acento} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Más opciones" hitSlop={6} onPress={masOpciones} style={e.cabeceraBoton}>
                <Icono nombre="opciones" tamano={22} color={t.acento} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Sincronizacion />
      {editandoCliente ? <EditarCliente q={q} cambiar={cambiar} alCerrar={() => setEditandoCliente(false)} /> : null}

      {/* El cliente: nombre y dirección; tocarla abre sus datos para llamarlo, escribirle o corregirlos. */}
      <TarjetaCliente q={q} alTocar={() => setEditandoCliente(true)} />

      {/* En qué va (pendiente o su número, y la versión) está en el título de la barra; aquí solo, si es una versión nueva, a cuál reemplaza. */}
      {q.previous_number ? <TextoM variante="chico" suave>Reemplaza al presupuesto {q.previous_number}</TextoM> : null}

      {/* Terminado: en qué va y cuánto es, a la vista en todas sus pestañas. */}
      {cerrado ? <ResumenCerrado q={q} /> : null}

      <PestanasParte partes={partes} valor={actualId} alElegir={setParte} />

      <PartesDeslizables posicion={posicion} total={partes.length} alIr={ir}>
      {cerrado ? (
        <>
          <View style={[e.parte, oculta('enviar')]}>
            {q.commercial_status === 'REJECTED' ? <NuevaVersion q={q} /> : null}
            <Animated.View entering={recienTerminado ? FadeInDown.duration(300).easing(EASE_OUT) : undefined}>
              <Envio q={q} recargar={recargar} />
            </Animated.View>
          </View>
          {q.commercial_status !== 'NONE' ? (
            <View style={[e.parte, oculta('seguimiento')]}>
              <Seguimiento q={q} recargar={recargar} />
            </View>
          ) : null}
          <View style={[e.parte, oculta('detalle')]}>
            {q.service_description || q.address ? (
              <TarjetaM>
                {q.service_description ? <TextoM>{q.service_description}</TextoM> : null}
                {q.address ? <TextoM variante="chico" suave>{q.address}</TextoM> : null}
              </TarjetaM>
            ) : null}
            {q.items.length ? (
              <TarjetaM>
                <TextoM variante="subtitulo" accessibilityRole="header">Ítems</TextoM>
                {q.items.map((i) => (
                  <View key={i.id} style={[e.item, { borderBottomColor: t.borde }]}>
                    <View style={e.flex}>
                      <TextoM>{i.description}</TextoM>
                      {i.kind === 'TASK' ? (
                        <TextoM variante="chico" suave>Tarea</TextoM>
                      ) : (
                        <TextoM variante="chico" suave style={e.monto}>{String(i.quantity).replace('.', ',')} {simboloUnidad(i.unit)} × {montoDe(i.unit_price, q.currency)}</TextoM>
                      )}
                    </View>
                    <TextoM fuerte style={e.monto}>{i.kind === 'TASK' && i.line_total === 0 ? 'Incluido' : montoDe(i.line_total, q.currency)}</TextoM>
                  </View>
                ))}
                {q.include_vat ? (
                  <View style={e.filaTotal}>
                    <TextoM suave>{q.vat_label ?? 'IVA'} ({q.vat_rate ?? 19}%)</TextoM>
                    <TextoM suave style={e.monto}>{montoDe(q.vat, q.currency)}</TextoM>
                  </View>
                ) : null}
                <View style={[e.filaTotal, e.total, { borderTopColor: t.texto }]}>
                  <View style={e.etiquetaTotal}>
                    <IconoDinero tamano={32} />
                    <TextoM fuerte>Total</TextoM>
                    <BotonOjo clave={delPresupuesto(id)} chico />
                  </View>
                  <TextoM variante="titulo" style={e.monto}>{montoDe(q.total, q.currency)}</TextoM>
                </View>
              </TarjetaM>
            ) : null}
            <VisitaLectura q={q} />
          </View>
        </>
      ) : (
        <>
          <View style={[e.parte, oculta('visita')]}>
            <Levantamiento key={`levantamiento-${vista.levantamiento}`} q={q} cambiar={cambiar} />
            <BotonM titulo="Seguir con el presupuesto" onPress={() => setParte('presupuesto')} />
          </View>
          <View style={[e.parte, oculta('presupuesto')]}>
            <Cierre key={`cierre-${vista.cierre}`} q={q} recargar={recargar} alTerminar={() => setRecienTerminado(true)} />
          </View>
        </>
      )}
      </PartesDeslizables>
      {/* Terminado: «Ver PDF» y la acción que toca ahora, flotando al pie (como «Guardar» y «Terminar» en uno pendiente). */}
      {cerrado ? <AccionesCerrado q={q} recargar={recargar} reserva={RESERVA} conCompartir={actualId !== 'enviar'} /> : null}
      {dialogo}
    </ScrollConBarra>
  );
}

const RESERVA = espacio.xxl * 2; // lo que queda debajo del contenido; la barra flotante lo necesita para saber dónde termina
const e = StyleSheet.create({
  etiquetaTotal: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  contenido: { padding: espacio.l, paddingBottom: RESERVA, gap: espacio.l },
  flex: { flex: 1 },
  parte: { gap: espacio.xl },
  oculta: { display: 'none' },
  accionesCabecera: { flexDirection: 'row', alignItems: 'center' },
  cabeceraBoton: { minWidth: MIN_TOQUE - 8, minHeight: MIN_TOQUE - 8, alignItems: 'center', justifyContent: 'center' },
  exito: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.l },
  item: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.m, paddingBottom: espacio.m, borderBottomWidth: StyleSheet.hairlineWidth },
  filaTotal: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
  total: { borderTopWidth: 2, paddingTop: espacio.m },
  monto: { fontVariant: ['tabular-nums'] },
});
