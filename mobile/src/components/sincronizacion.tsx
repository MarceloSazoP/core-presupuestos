import { Alert, Pressable, StyleSheet } from 'react-native';
import { Icono, Texto } from '@/components/ui';
import { descartarFallidas, fallidas, reintentarFallidas, useCola, vaciar } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Indicador de cambios sin enviar (Arquitectura §5, regla 6): no bloquea la captura. Un toque reintenta; si hay
// operaciones que el servidor rechazó, muestra el motivo y deja reintentar o descartar (nunca se pierden en silencio).
export function Sincronizacion() {
  const t = useTema();
  const { pendientes, fallidas: conError } = useCola();
  if (!pendientes && !conError) return null;

  async function tocar() {
    if (!conError) return void vaciar();
    const motivos = [...new Set((await fallidas()).map((o) => o.last_error ?? 'Error'))].join('\n');
    Alert.alert('Algo no se pudo enviar', `${motivos}\n\nPuedes reintentar o descartar esos cambios.`, [
      { text: 'Más tarde', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => void descartarFallidas() },
      { text: 'Reintentar', onPress: () => void reintentarFallidas() },
    ]);
  }

  const texto = conError ? `${conError} ${conError === 1 ? 'cambio requiere' : 'cambios requieren'} atención` : `${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} sin enviar · toca para reintentar`;
  return (
    <Pressable accessibilityRole="button" onPress={() => void tocar()} style={({ pressed }) => [e.barra, { backgroundColor: `${conError ? t.error : t.aviso}1A`, borderColor: `${conError ? t.error : t.aviso}66`, opacity: pressed ? 0.7 : 1 }]}>
      <Icono nombre={conError ? 'alerta' : 'sincronizar'} tamano={16} color={conError ? t.error : t.aviso} />
      <Texto variante="chico" color={conError ? 'error' : 'aviso'} fuerte style={e.texto}>{texto}</Texto>
    </Pressable>
  );
}

const e = StyleSheet.create({
  barra: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.l },
  texto: { flex: 1 },
});
