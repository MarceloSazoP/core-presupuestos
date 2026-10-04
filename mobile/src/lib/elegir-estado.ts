import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { estadosPosibles, type EstadoElegible } from '@/lib/estados';

// Hoja de opciones para pasar un presupuesto a otro estado: en iPhone es la hoja nativa (ActionSheet); en Android, un aviso con
// botones. Solo ofrece los estados posibles (nunca el actual).
export function elegirEstado(q: { doc_status: string; commercial_status: string }, alElegir: (estado: EstadoElegible) => void) {
  const posibles = estadosPosibles(q);
  if (posibles.length === 0) return;
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Pasar a', options: [...posibles.map((p) => p.texto), 'Cancelar'], cancelButtonIndex: posibles.length },
      (i) => i < posibles.length && alElegir(posibles[i]!.id),
    );
  } else {
    Alert.alert('Pasar a', undefined, [...posibles.map((p) => ({ text: p.texto, onPress: () => alElegir(p.id) })), { text: 'Cancelar', style: 'cancel' as const }]);
  }
}
