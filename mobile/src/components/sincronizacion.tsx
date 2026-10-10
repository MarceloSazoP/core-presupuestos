import { Pressable, StyleSheet, View } from 'react-native';
import { useDialogo } from '@/components/dialogo';
import { TextoM } from '@/components/material';
import { Icono, Texto } from '@/components/ui';
import { useSinSenal } from '@/lib/conexion';
import { descartarFallidas, fallidas, reintentarFallidas, useCola, vaciar } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Indicador de cambios sin enviar (Arquitectura §5, regla 6): no bloquea la captura. Un toque reintenta; si hay
// operaciones que el servidor rechazó, muestra el motivo y deja reintentar o descartar (nunca se pierden en silencio).
// Sin señal lo dice con calma (en azul de información, no es un error): lo capturado queda en el teléfono y se envía solo después.
export function Sincronizacion() {
  const t = useTema();
  const { pendientes, fallidas: conError } = useCola();
  const sinSenal = useSinSenal();
  const { dialogo, decidir } = useDialogo();
  if (!pendientes && !conError && !sinSenal) return null;

  async function tocar() {
    if (!conError) return void vaciar();
    const motivos = [...new Set((await fallidas()).map((o) => o.last_error ?? 'Error'))].join('\n');
    decidir('Algo no se pudo enviar', `${motivos}\n\nPuedes reintentar o descartar esos cambios.`, [
      { text: 'Más tarde', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => void descartarFallidas() },
      { text: 'Reintentar', onPress: () => void reintentarFallidas() },
    ]);
  }

  // Lo que falló pide una decisión y va primero; sin señal, reintentar no sirve: el aviso solo informa.
  const tono = conError ? 'error' : sinSenal ? 'info' : 'aviso';
  const cambios = (n: number) => `${n} ${n === 1 ? 'cambio' : 'cambios'}`;
  const texto = conError
    ? `${conError} ${conError === 1 ? 'cambio requiere' : 'cambios requieren'} atención`
    : sinSenal
      ? pendientes
        ? `Sin conexión · ${cambios(pendientes)} esperando. Se envían solos cuando vuelva la señal.`
        : 'Sin conexión. Lo que captures queda en el teléfono y se envía solo cuando vuelva la señal.'
      : `${cambios(pendientes)} sin enviar · toca para reintentar`;
  const icono = conError ? 'alerta' : sinSenal ? 'sinSenal' : 'sincronizar';
  return (
    <>
      <Pressable
        accessibilityRole={sinSenal && !conError ? 'text' : 'button'}
        accessibilityLiveRegion="polite"
        disabled={sinSenal && !conError}
        onPress={() => void tocar()}
        style={({ pressed }) => [e.barra, { backgroundColor: `${t[tono]}1A`, borderColor: `${t[tono]}66`, opacity: pressed ? 0.7 : 1 }]}
      >
        <Icono nombre={icono} tamano={16} color={t[tono]} />
        <Texto variante="chico" color={tono} fuerte style={e.texto}>{texto}</Texto>
      </Pressable>
      {dialogo}
    </>
  );
}

// Junto a una acción que necesita internet y quedó desactivada sin señal: por qué, en una línea (patrón «formulario bloqueado»).
export function AvisoSinSenal({ texto }: { texto: string }) {
  const t = useTema();
  return (
    <View style={e.aviso} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Icono nombre="sinSenal" tamano={16} color={t.info} />
      <TextoM variante="chico" color="info" style={e.texto}>Sin conexión: {texto}</TextoM>
    </View>
  );
}

const e = StyleSheet.create({
  barra: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.l, paddingVertical: espacio.s },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  texto: { flex: 1 },
});
