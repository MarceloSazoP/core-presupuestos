import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icono, Presionable, Tarjeta, Texto, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// El menú de Configurar con el aspecto de Ajustes de iPhone: grupos de filas en una tarjeta, cada una con su ícono blanco sobre un cuadrado
// de color, el nombre, un valor a la derecha si lo hay y la flecha «>» que indica que abre una ventana.
export function GrupoAjustes({ children }: { children: ReactNode }) {
  return <Tarjeta style={e.grupo}>{children}</Tarjeta>;
}

export function FilaAjuste({ icono, color, titulo, valor, alTocar, primera }: { icono: NombreIcono; color: string; titulo: string; valor?: string; alTocar: () => void; primera?: boolean }) {
  const t = useTema();
  return (
    <Presionable accessibilityRole="button" accessibilityLabel={valor ? `${titulo}: ${valor}` : titulo} onPress={alTocar} estilo={[e.fila, !primera && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }]}>
      <View style={[e.icono, { backgroundColor: color }]}>
        <Icono nombre={icono} tamano={18} color="#FFFFFF" />
      </View>
      <Texto style={e.titulo}>{titulo}</Texto>
      {valor ? <Texto suave numberOfLines={1} style={e.valor}>{valor}</Texto> : null}
      <Icono nombre="siguiente" tamano={14} color={t.suave} />
    </Presionable>
  );
}

const e = StyleSheet.create({
  grupo: { padding: 0, gap: 0, overflow: 'hidden' },
  fila: { minHeight: MIN_TOQUE + 6, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l },
  icono: { width: 32, height: 32, borderRadius: radio.s - 2, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1 },
  valor: { flexShrink: 1, maxWidth: '45%' },
});
