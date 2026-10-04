import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pressable as Toque } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import type { ResumenPresupuesto } from '@/api/types';
import { Icono, Pastilla, Texto, TRANSICION_PRESION } from '@/components/ui';
import { diaCorto } from '@/lib/fechas';
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
        <Texto variante="chico" suave numberOfLines={2}>{q.service_description || 'Sin descripción todavía'}</Texto>
        <View style={e.abajo}>
          <Pastilla texto={estado.texto} tono={estado.tono} />
          {identificador ? <Text numberOfLines={1} style={[e.id, { color: t.suave }]}>{identificador}</Text> : null}
        </View>
        {q.next_contact_date ? (
          <View style={[e.contacto, { backgroundColor: `${t.seguimiento}1F` }]}>
            <Icono nombre="reloj" tamano={14} color={t.seguimiento} />
            <Texto variante="chico" fuerte color="seguimiento">Contactar el {diaCorto(q.next_contact_date)}</Texto>
          </View>
        ) : null}
      </Animated.View>
    </Toque>
  );
  if (!puedeEliminar) {
    if (posibles.length === 0) return fila;
    // Mini pestañas que cuelgan de la tarjeta: «Pasar a» y un bloque de color por cada estado posible.
    return (
      <View>
        {fila}
        <View style={e.mini}>
          <Texto variante="chico" suave style={e.miniEtiqueta}>Pasar a</Texto>
          {posibles.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Pasar a ${s.texto}`}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
              onPress={() => cambiar(s.id)}
              style={({ pressed }) => [e.miniPestana, { backgroundColor: t[s.tono], opacity: pressed ? 0.7 : 1 }]}
            >
              <Texto variante="chico" fuerte color="sobreAcento" numberOfLines={1}>{s.texto}</Texto>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
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
  fila: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', padding: espacio.l, gap: espacio.s, minHeight: MIN_TOQUE,
  },
  arriba: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.m },
  flex: { flex: 1 },
  abajo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: 2 },
  monto: { fontVariant: ['tabular-nums'] },
  // El código corto se dicta letra por letra: va en monoespaciada.
  id: { flexShrink: 1, fontFamily: Platform.select(MONO), fontSize: letra.chico - 1, letterSpacing: 0.5 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radio.s, borderCurve: 'continuous', paddingHorizontal: espacio.m, paddingVertical: 6 },
  contenedor: { borderRadius: radio.l, borderCurve: 'continuous', overflow: 'hidden' }, // recorta lo que sale por las esquinas redondeadas
  accion: { width: 96, borderRadius: radio.l, borderCurve: 'continuous' },
  accionToque: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Las mini pestañas se pegan al borde de abajo de la tarjeta (marginTop negativo) con las esquinas de abajo redondeadas.
  mini: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, marginTop: -1, paddingLeft: espacio.l },
  miniEtiqueta: { marginRight: espacio.xs },
  miniPestana: { minHeight: 32, justifyContent: 'center', paddingHorizontal: espacio.m, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderCurve: 'continuous' },
});
