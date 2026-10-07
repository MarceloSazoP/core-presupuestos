import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Divider, List, Text } from 'react-native-paper';
import { TarjetaM } from '@/components/material';
import { Icono, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// El menú de Configurar con listas de Material 3: grupos de filas en una tarjeta elevada, separadas por una línea. Cada fila lleva su ícono
// en un círculo tonal de su color, el nombre, un valor a la derecha si lo hay y la flecha que indica que abre una ventana.
export function GrupoAjustes({ children }: { children: ReactNode }) {
  const filas = Children.toArray(children);
  return (
    <TarjetaM sinRelleno>
      {filas.map((fila, i) => (
        <Fragment key={i}>
          {i > 0 ? <Divider /> : null}
          {fila}
        </Fragment>
      ))}
    </TarjetaM>
  );
}

// `primera` ya no hace falta (el grupo pone las líneas), pero se acepta para no cambiar a quien la usa.
export function FilaAjuste({ icono, color, titulo, valor, alTocar }: { icono: NombreIcono; color: string; titulo: string; valor?: string; alTocar: () => void; primera?: boolean }) {
  const t = useTema();
  return (
    <List.Item
      title={titulo}
      titleStyle={e.titulo}
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={valor ? `${titulo}: ${valor}` : titulo}
      style={e.fila}
      left={() => (
        <View style={[e.icono, { backgroundColor: `${color}26` }]}>
          <Icono nombre={icono} tamano={20} color={color} />
        </View>
      )}
      right={() => (
        <View style={e.derecha}>
          {valor ? <Text variant="bodyMedium" numberOfLines={1} style={[e.valor, { color: t.suave }]}>{valor}</Text> : null}
          <Icono nombre="siguiente" tamano={14} color={t.suave} />
        </View>
      )}
    />
  );
}

// Una acción (no abre otra pantalla): su ícono en el círculo tonal, el nombre y, debajo, qué hace. Mientras trabaja, el indicador de
// Material a la derecha y la fila no se puede volver a tocar. `peligro`: el nombre en rojo.
export function FilaAccion({ icono, color, titulo, descripcion, cargando, peligro, alTocar }: { icono: NombreIcono; color: string; titulo: string; descripcion?: string; cargando?: boolean; peligro?: boolean; alTocar: () => void }) {
  const t = useTema();
  return (
    <List.Item
      title={titulo}
      description={descripcion}
      descriptionNumberOfLines={3}
      titleStyle={[e.titulo, { color: peligro ? t.error : t.texto }]}
      descriptionStyle={{ color: t.suave }}
      onPress={cargando ? undefined : alTocar}
      accessibilityRole="button"
      accessibilityLabel={descripcion ? `${titulo}. ${descripcion}` : titulo}
      accessibilityState={{ busy: !!cargando }}
      style={e.fila}
      left={() => (
        <View style={[e.icono, { backgroundColor: `${color}26` }]}>
          <Icono nombre={icono} tamano={20} color={color} />
        </View>
      )}
      right={() => (cargando ? <View style={e.derecha}><ActivityIndicator size={18} color={t.acento} /></View> : null)}
    />
  );
}

const e = StyleSheet.create({
  fila: { minHeight: MIN_TOQUE + 8, justifyContent: 'center', paddingLeft: espacio.l, paddingRight: espacio.l },
  titulo: { fontSize: 16 },
  icono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  derecha: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, maxWidth: '55%' },
  valor: { flexShrink: 1 },
});
