import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { ResumenPresupuesto } from '@/api/types';
import { Pastilla, Texto } from '@/components/ui';
import { diaCorto } from '@/lib/fechas';
import { clp } from '@/lib/formato';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Estado que se muestra: el comercial manda una vez que el presupuesto salió; antes, el documental.
function estadoVisible(q: ResumenPresupuesto): { texto: string; tono: 'aviso' | 'ok' | 'suave' } {
  if (q.doc_status !== 'FINALIZED') return { texto: 'Pendiente', tono: 'aviso' };
  const comercial = { NONE: 'Cerrado', SENT: 'Enviado', FOLLOW_UP: 'Seguimiento', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado' } as const;
  return { texto: comercial[q.commercial_status], tono: q.commercial_status === 'ACCEPTED' || q.commercial_status === 'SENT' ? 'ok' : 'suave' }; // enviado y aceptado, en verde
}

// `sinCliente`: en la ficha del cliente su nombre sobra y se muestra el número del presupuesto.
// `onEliminar`: los presupuestos pendientes se eliminan deslizando la fila hacia la izquierda o manteniéndola apretada; los
// terminados no se pueden eliminar (Contrato API §6). Siempre se pide confirmación: no se puede deshacer.
export function FilaPresupuesto({ q, sinCliente = false, onEliminar }: { q: ResumenPresupuesto; sinCliente?: boolean; onEliminar?: (q: ResumenPresupuesto) => void }) {
  const t = useTema();
  const swipe = useRef<SwipeableMethods>(null);
  const puedeEliminar = !!onEliminar && q.doc_status !== 'FINALIZED';
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
      accessibilityActions={puedeEliminar ? [{ name: 'delete', label: 'Eliminar' }] : undefined}
      onAccessibilityAction={(a) => a.nativeEvent.actionName === 'delete' && confirmar()}
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
  if (!puedeEliminar) return fila;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable accessibilityRole="button" accessibilityLabel="Eliminar presupuesto" onPress={confirmar} style={[e.eliminar, { backgroundColor: t.error }]}>
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
  eliminar: { width: 96, marginLeft: espacio.s, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
