import type { Decidir } from '@/components/dialogo';
import { estadosPosibles, type EstadoElegible } from '@/lib/estados';

// Opciones para pasar un presupuesto a otro estado, en el diálogo de Material de la pantalla que lo pide (`decidir`, de `useDialogo`):
// igual en iPhone y Android. Solo ofrece los estados posibles (nunca el actual).
export function elegirEstado(q: { doc_status: string; commercial_status: string }, alElegir: (estado: EstadoElegible) => void, decidir: Decidir) {
  const posibles = estadosPosibles(q);
  if (posibles.length === 0) return;
  decidir('Pasar a', undefined, [...posibles.map((p) => ({ text: p.texto, onPress: () => alElegir(p.id) })), { text: 'Cancelar', style: 'cancel' as const }]);
}
