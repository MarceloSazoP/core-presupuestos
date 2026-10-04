import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { ResumenPresupuesto } from '@/api/types';
import { Pastilla, Texto } from '@/components/ui';
import { diaCorto } from '@/lib/fechas';
import { ESTADOS, estadosPosibles, type EstadoElegible } from '@/lib/estados';
import { clp } from '@/lib/formato';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Estado que se muestra: el comercial manda una vez que el presupuesto salió; antes, el documental.
function estadoVisible(q: ResumenPresupuesto): { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'error' } {
  if (q.doc_status !== 'FINALIZED') return { texto: 'Pendiente', tono: 'aviso' };
  const comercial = ESTADOS.find((s) => s.id === q.commercial_status);
  return comercial ? { texto: comercial.texto, tono: comercial.tono } : { texto: 'Cerrado', tono: 'suave' }; // cerrado y aún sin enviar
}

// `sinCliente`: en la ficha del cliente su nombre sobra y se muestra el número del presupuesto.
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
  const swipe = useRef<SwipeableMethods>(null);
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
  const identificador = [q.code_id, sinCliente ? null : q.number].filter(Boolean).join(' · ');
  const fila = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${estado.texto}`}
      accessibilityActions={puedeEliminar ? [{ name: 'delete', label: 'Eliminar' }] : posibles.map((s) => ({ name: s.id, label: `Pasar a ${s.texto}` }))}
      onAccessibilityAction={(a) => {
        if (a.nativeEvent.actionName === 'delete') confirmar();
        else cambiar(a.nativeEvent.actionName as EstadoElegible);
      }}
      onPress={() => router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } })}
      onLongPress={puedeEliminar ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); confirmar(); } : undefined}
      style={({ pressed }) => [e.fila, { backgroundColor: t.tarjeta, borderColor: t.borde, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={e.filaTexto}>
        <Texto fuerte numberOfLines={1}>{titulo}</Texto>
        {identificador ? <Texto variante="chico" suave style={e.id}>{identificador}</Texto> : null}
        <Texto variante="chico" suave numberOfLines={2}>{q.service_description || 'Sin descripción todavía'}</Texto>
        <Pastilla texto={estado.texto} tono={estado.tono} />
        {q.next_contact_date ? <Texto variante="chico" suave>Contactar el {diaCorto(q.next_contact_date)}</Texto> : null}
      </View>
      <Texto fuerte style={e.monto}>{q.total > 0 ? clp(q.total) : '—'}</Texto>
    </Pressable>
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
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable accessibilityRole="button" accessibilityLabel="Eliminar presupuesto" onPress={confirmar} style={[e.accion, { backgroundColor: t.error }]}>
          <Texto fuerte color="sobreAcento">Eliminar</Texto>
        </Pressable>
      )}
    >
      {fila}
    </ReanimatedSwipeable>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: espacio.l, minHeight: MIN_TOQUE },
  filaTexto: { flex: 1, gap: espacio.xs },
  monto: { fontVariant: ['tabular-nums'] },
  id: { fontVariant: ['tabular-nums'], letterSpacing: 1 },
  accion: { width: 96, marginLeft: espacio.s, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  // Las mini pestañas se pegan al borde de abajo de la tarjeta (marginTop negativo) con las esquinas de abajo redondeadas.
  mini: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, marginTop: -1, paddingLeft: espacio.l },
  miniEtiqueta: { marginRight: espacio.xs },
  miniPestana: { minHeight: 32, justifyContent: 'center', paddingHorizontal: espacio.m, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderCurve: 'continuous' },
});
