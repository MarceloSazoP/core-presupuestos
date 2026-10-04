import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pressable as Toque } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import type { ResumenPresupuesto } from '@/api/types';
import { Icono, Texto, TRANSICION_PRESION } from '@/components/ui';
import { diaCorto } from '@/lib/fechas';
import { elegirEstado } from '@/lib/elegir-estado';
import { ESTADOS, estadosPosibles, type EstadoElegible } from '@/lib/estados';
import { clp } from '@/lib/formato';
import { espacio, letra, MIN_TOQUE, MONO, radio, useTema } from '@/theme';

// Estado que se muestra: el comercial manda una vez que el presupuesto salió; antes, el documental.
function estadoVisible(q: ResumenPresupuesto): { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'seguimiento' | 'error' } {
  if (q.doc_status !== 'FINALIZED') return { texto: 'Pendiente', tono: 'aviso' };
  const comercial = ESTADOS.find((s) => s.id === q.commercial_status);
  return comercial ? { texto: comercial.texto, tono: comercial.tono } : { texto: 'Cerrado', tono: 'suave' }; // cerrado y aún sin enviar
}

// `sinCliente`: en la ficha del cliente su nombre sobra y se muestra el número del presupuesto.
// Botón rojo de eliminar: nace de la orilla al deslizar (su opacidad sigue el avance del gesto), así nunca se asoma por los
// bordes redondeados de la tarjeta ni se queda a la vista al volver.
function AccionEliminar({ progreso, onPress }: { progreso: SharedValue<number>; onPress: () => void }) {
  const t = useTema();
  const estilo = useAnimatedStyle(() => ({ opacity: interpolate(progreso.get(), [0, 0.2, 1], [0, 1, 1], Extrapolation.CLAMP) }));
  return (
    <Animated.View style={[e.accion, { backgroundColor: t.error }, estilo]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Eliminar presupuesto" onPress={onPress} style={e.accionToque}>
        <Texto fuerte color="sobreAcento">Eliminar</Texto>
      </Pressable>
    </Animated.View>
  );
}

// - `onEliminar`: un presupuesto pendiente se elimina deslizando la fila hacia la izquierda o manteniéndola apretada (los
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
  const reducido = useReducedMotion();
  const [presionado, setPresionado] = useState(false);
  const swipe = useRef<SwipeableMethods>(null);
  const abierto = useRef(false); // el botón rojo está a la vista
  const ultimoArrastre = useRef(0); // cuándo empezó o terminó el último deslizado
  // FlashList recicla las filas: el estado del deslizado de una no debe pasar a otro presupuesto.
  useEffect(() => {
    swipe.current?.reset();
    abierto.current = false;
  }, [q.id]);
  // Solo un toque limpio abre el presupuesto: con el botón abierto el toque lo cierra, y soltar el dedo después de un deslizado
  // no cuenta como toque.
  const abrir = () => {
    if (abierto.current) return swipe.current?.close();
    if (Date.now() - ultimoArrastre.current < 400) return;
    router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } });
  };
  const puedeEliminar = !!onEliminar && q.doc_status !== 'FINALIZED';
  const posibles = onCambiarEstado ? estadosPosibles(q) : [];
  const cambiar = (s: EstadoElegible) => {
    void Haptics.selectionAsync();
    onCambiarEstado?.(q, s);
  };

  const confirmar = () => {
    swipe.current?.close();
    Alert.alert(`¿Eliminar el presupuesto de ${q.customer.name}?`, 'Se borran también sus fotos, notas de voz y notas. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onEliminar?.(q) },
    ]);
  };
  const estado = estadoVisible(q);
  const titulo = sinCliente ? (q.number ?? 'Sin número todavía') : q.customer.name;
  // El ID corto es con lo que la persona nombra cada presupuesto; el número CP aparece al terminarlo.
  const identificador = [q.code_id, (q.version ?? 1) > 1 ? `Versión ${q.version}` : null, sinCliente ? null : q.number].filter(Boolean).join(' · ');
  // La tarjeta es un botón de gesture-handler (no el de React Native): así comparte los gestos con el deslizado y, si el dedo
  // arrastra, el toque se cancela. Con el de RN, soltar después de deslizar abría el presupuesto.
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
      onPressIn={() => setPresionado(true)}
      onPressOut={() => setPresionado(false)}
      onLongPress={puedeEliminar ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); confirmar(); } : undefined}
    >
      {/* La tarjeta se encoge apenas al tocarla (transición CSS de Reanimated: 120 ms, sin estado por cuadro). */}
      <Animated.View style={[e.fila, TRANSICION_PRESION, { backgroundColor: t.tarjeta, borderColor: t.borde, transform: [{ scale: presionado && !reducido ? 0.98 : 1 }] }]}>
        <View style={e.arriba}>
          <Texto fuerte numberOfLines={1} style={e.flex}>{titulo}</Texto>
          <Texto fuerte style={e.monto}>{q.total > 0 ? clp(q.total) : '—'}</Texto>
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
  if (!puedeEliminar) return fila;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      dragOffsetFromRightEdge={16} // un arrastre corto o casi vertical no abre el botón
      rightThreshold={40}
      overshootRight={false}
      containerStyle={e.contenedor}
      onSwipeableOpenStartDrag={() => (ultimoArrastre.current = Date.now())}
      onSwipeableCloseStartDrag={() => (ultimoArrastre.current = Date.now())}
      onSwipeableWillOpen={() => (ultimoArrastre.current = Date.now())}
      onSwipeableOpen={() => (abierto.current = true)}
      onSwipeableClose={() => {
        abierto.current = false;
        ultimoArrastre.current = Date.now();
      }}
      renderRightActions={(progreso) => <AccionEliminar progreso={progreso} onPress={confirmar} />}
    >
      {fila}
    </ReanimatedSwipeable>
  );
}

const e = StyleSheet.create({
  // Sin sombra: la fila que se desliza recorta lo que sale de sus bordes, y todas las tarjetas de la lista deben verse iguales.
  fila: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', paddingVertical: 14, paddingHorizontal: espacio.l, gap: 6, minHeight: MIN_TOQUE },
  arriba: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.m },
  flex: { flex: 1 },
  abajo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s, marginTop: 2 },
  estadoToque: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estadoTexto: { fontSize: letra.chico, fontWeight: '600' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  monto: { fontVariant: ['tabular-nums'] },
  // El código corto se dicta letra por letra: va en monoespaciada, en gris tenue.
  id: { flexShrink: 1, fontFamily: Platform.select(MONO), fontSize: letra.chico - 2, letterSpacing: 0.5, opacity: 0.8 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  contenedor: { borderRadius: radio.l, borderCurve: 'continuous', overflow: 'hidden' }, // recorta lo que sale por las esquinas redondeadas
  accion: { width: 96, borderRadius: radio.l, borderCurve: 'continuous' },
  accionToque: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
