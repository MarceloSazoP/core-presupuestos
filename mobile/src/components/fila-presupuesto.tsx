import * as Haptics from 'expo-haptics';
import { hayDeslizadoReciente } from '@/lib/deslizado';
import { IconoDinero } from '@/components/icono-dinero';
import { LISTA, useDinero } from '@/lib/montos';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable as Toque } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { ResumenPresupuesto } from '@/api/types';
import { Icono, Texto, TRANSICION_PRESION } from '@/components/ui';
import { diaCorto } from '@/lib/fechas';
import { elegirEstado } from '@/lib/elegir-estado';
import { ESTADOS, estadosPosibles, type EstadoElegible } from '@/lib/estados';
import { espacio, letra, MIN_TOQUE, MONO, radio, useTema } from '@/theme';

// Estado que se muestra: el comercial manda una vez que el presupuesto salió; antes, el documental.
function estadoVisible(q: ResumenPresupuesto): { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'seguimiento' | 'error' } {
  if (q.doc_status !== 'FINALIZED') return { texto: 'Pendiente', tono: 'aviso' };
  const comercial = ESTADOS.find((s) => s.id === q.commercial_status);
  return comercial ? { texto: comercial.texto, tono: comercial.tono } : { texto: 'Cerrado', tono: 'suave' }; // cerrado y aún sin enviar
}

// `sinCliente`: en la ficha del cliente su nombre sobra y se muestra el número del presupuesto.
// Eliminar = mantener apretada la tarjeta: tras un instante (para no mostrarlo en un toque normal) una barra roja con «Eliminar» se
// va llenando de izquierda a derecha; al llenarse aparece la pregunta de confirmación. Soltar antes la cancela.
const ESPERA_MS = 220;
const LLENADO_MS = 800;

// - `onEliminar`: un presupuesto pendiente se elimina manteniendo apretada su tarjeta hasta que se llene la barra roja (los
//   terminados no, Contrato API §6). Siempre con confirmación.
// - `onCambiarEstado`: uno ya enviado muestra bajo la tarjeta mini pestañas con los demás estados (nunca el actual); un
//   toque lo pasa a ese estado.
export function FilaPresupuesto({
  q,
  sinCliente = false,
  onEliminar,
  onCambiarEstado,
}: {
  q: ResumenPresupuesto;
  sinCliente?: boolean;
  onEliminar?: (q: ResumenPresupuesto) => void;
  onCambiarEstado?: (q: ResumenPresupuesto, estado: EstadoElegible) => void;
}) {
  const t = useTema();
  const montoDe = useDinero(LISTA);
  const reducido = useReducedMotion();
  const [presionado, setPresionado] = useState(false);
  const relleno = useSharedValue(0); // 0 a 1: cuánto se ha llenado la barra roja
  useEffect(() => {
    // FlashList recicla las filas: la barra de un presupuesto no debe quedar a medias en otro.
    cancelAnimation(relleno);
    relleno.set(0);
  }, [q.id, relleno]);
  const abrirYa = () => router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } });
  const puedeEliminar = !!onEliminar && q.doc_status !== 'FINALIZED';
  const posibles = onCambiarEstado ? estadosPosibles(q) : [];
  const cambiar = (s: EstadoElegible) => {
    void Haptics.selectionAsync();
    onCambiarEstado?.(q, s);
  };

  const confirmar = () => {
    Alert.alert(`¿Eliminar el presupuesto de ${q.customer.name}?`, 'Se borran también sus fotos, notas de voz y notas. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onEliminar?.(q) },
    ]);
  };
  // Un toque abre el presupuesto. Soltar el dedo tras deslizar entre pestañas no cuenta como toque.
  const abrir = () => {
    if (hayDeslizadoReciente()) return;
    abrirYa();
  };
  // Al apretar, tras ESPERA_MS empieza a llenarse la barra; al llenarse, pide confirmar. Al soltar se vacía.
  const empezarLlenado = () => {
    if (!puedeEliminar) return;
    relleno.set(withDelay(ESPERA_MS, withTiming(1, { duration: LLENADO_MS, easing: Easing.linear }, (fin) => {
      if (fin) runOnJS(llenada)();
    })));
  };
  const llenada = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    confirmar();
  };
  const soltar = () => {
    cancelAnimation(relleno);
    relleno.set(withTiming(0, { duration: 160 }));
  };
  const estiloRelleno = useAnimatedStyle(() => ({ transform: [{ scaleX: relleno.get() }] }));
  const estiloEtiqueta = useAnimatedStyle(() => ({ opacity: interpolate(relleno.get(), [0.12, 0.35], [0, 1], Extrapolation.CLAMP) }));
  const estado = estadoVisible(q);
  const titulo = sinCliente ? (q.number ?? 'Sin número todavía') : q.customer.name;
  // El ID corto es con lo que la persona nombra cada presupuesto; el número CP aparece al terminarlo.
  const identificador = [q.code_id, (q.version ?? 1) > 1 ? `Versión ${q.version}` : null, sinCliente ? null : q.number].filter(Boolean).join(' · ');
  // La tarjeta es un botón de gesture-handler (no el de React Native): así comparte los gestos con el deslizado entre pestañas y,
  // si el dedo arrastra, el toque se cancela.
  const fila = (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${estado.texto}`}
      accessibilityActions={puedeEliminar ? [{ name: 'delete', label: 'Eliminar' }] : posibles.map((s) => ({ name: s.id, label: `Pasar a ${s.texto}` }))}
      onAccessibilityAction={(a) => {
        if (a.nativeEvent.actionName === 'delete') confirmar();
        else cambiar(a.nativeEvent.actionName as EstadoElegible);
      }}
      onPress={abrir}
      onPressIn={() => {
        setPresionado(true);
        empezarLlenado();
      }}
      onPressOut={() => {
        setPresionado(false);
        soltar();
      }}
    >
      {/* La tarjeta se encoge apenas al tocarla (transición CSS de Reanimated: 120 ms, sin estado por cuadro). */}
      <Animated.View style={[e.fila, TRANSICION_PRESION, { backgroundColor: t.tarjeta, borderColor: t.borde, transform: [{ scale: presionado && !reducido ? 0.98 : 1 }] }]}>
        {puedeEliminar ? (
          <>
            <Animated.View pointerEvents="none" style={[e.relleno, { backgroundColor: t.error }, estiloRelleno]} />
            <Animated.View pointerEvents="none" style={[e.etiquetaEliminar, estiloEtiqueta]}>
              <Icono nombre="cerrar" tamano={18} color="#FFFFFF" />
              <Text style={e.textoEliminar}>Eliminar</Text>
            </Animated.View>
          </>
        ) : null}
        <View style={e.arriba}>
          <Texto fuerte numberOfLines={1} style={e.flex}>{titulo}</Texto>
          <View style={e.totalFila}>
            <IconoDinero tamano={22} />
            <Texto fuerte style={e.monto}>{q.total > 0 ? montoDe(q.total, q.currency) : '—'}</Texto>
          </View>
        </View>
        <Texto variante="chico" suave numberOfLines={1}>{q.service_description || 'Sin descripción todavía'}</Texto>
        <View style={e.abajo}>
          {/* El estado es una palabra con su punto de color. Si se puede cambiar, es un botón que abre la hoja nativa «Pasar a». */}
          {posibles.length > 0 ? (
            <Toque accessibilityRole="button" accessibilityLabel={`${estado.texto}. Cambiar estado`} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} onPress={() => elegirEstado(q, cambiar)} style={e.estadoToque}>
              <View style={[e.punto, { backgroundColor: t[estado.tono] }]} />
              <Text style={[e.estadoTexto, { color: t[estado.tono] }]}>{estado.texto}</Text>
              <Icono nombre="despliegue" tamano={12} color={t[estado.tono]} />
            </Toque>
          ) : (
            <View style={e.estadoToque}>
              <View style={[e.punto, { backgroundColor: t[estado.tono] }]} />
              <Text style={[e.estadoTexto, { color: t[estado.tono] }]}>{estado.texto}</Text>
            </View>
          )}
          {identificador ? <Text numberOfLines={1} style={[e.id, { color: t.suave }]}>{identificador}</Text> : null}
        </View>
        {q.next_contact_date ? (
          <View style={e.contacto}>
            <Icono nombre="reloj" tamano={14} color={t.seguimiento} />
            <Texto variante="chico" fuerte color="seguimiento">Contactar el {diaCorto(q.next_contact_date)}</Texto>
          </View>
        ) : null}
      </Animated.View>
    </Toque>
  );
  return fila;
}

const e = StyleSheet.create({
  // Sin sombra: la fila que se desliza recorta lo que sale de sus bordes, y todas las tarjetas de la lista deben verse iguales.
  fila: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', paddingVertical: 14, paddingHorizontal: espacio.l, gap: 6, minHeight: MIN_TOQUE },
  relleno: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, transformOrigin: 'left' },
  etiquetaEliminar: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s },
  textoEliminar: { color: '#FFFFFF', fontSize: letra.cuerpo, fontWeight: '700' },
  arriba: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.m },
  flex: { flex: 1 },
  abajo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s, marginTop: 2 },
  estadoToque: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estadoTexto: { fontSize: letra.chico, fontWeight: '600' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  monto: { fontVariant: ['tabular-nums'] },
  totalFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  // El código corto se dicta letra por letra: va en monoespaciada, en gris tenue.
  id: { flexShrink: 1, fontFamily: Platform.select(MONO), fontSize: letra.chico - 2, letterSpacing: 0.5, opacity: 0.8 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  contenedor: { borderRadius: radio.l, borderCurve: 'continuous', overflow: 'hidden' }, // recorta lo que sale por las esquinas redondeadas
  accion: { width: 96, borderRadius: radio.l, borderCurve: 'continuous' },
  accionToque: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
