import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Título de la barra que también es un botón entre dos pantallas, para no tener un botón aparte:
// - hacia adelante: «Inicio → Presupuestos» (la pantalla actual y, en un chip, a dónde se va);
// - hacia atrás: «Inicio ← Presupuestos» (el chip, a la izquierda, es la pantalla a la que se vuelve; la actual queda a la derecha).
// Con Material 3: la pantalla actual con su ícono en un círculo tonal y su nombre en «título medio» (en «título grande» no cabe junto al
// chip en la barra del iPhone); el destino, un chip tonal con su ícono y la onda al tocar (32 de alto; el toque se agranda a 48).
type Pantalla = { texto: string; icono: SymbolViewProps['name'] };

export function TituloIr({ actual, destino, sentido, alIr }: { actual: Pantalla; destino: Pantalla; sentido: 'adelante' | 'atras'; alIr: () => void }) {
  const t = useTema();
  const pantalla = (p: Pantalla) => (
    <View style={e.pantalla}>
      <View style={[e.circulo, { backgroundColor: `${t.acento}1F` }]}>
        <SymbolView name={p.icono} size={16} tintColor={t.acento} fallback={<View />} />
      </View>
      <Text variant="titleMedium" numberOfLines={1} style={[e.actual, { color: t.texto }]}>{p.texto}</Text>
    </View>
  );
  const chip = (
    <TouchableRipple
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${destino.texto}`}
      hitSlop={8}
      borderless
      onPress={() => {
        void Haptics.selectionAsync();
        alIr();
      }}
      style={[e.chip, { backgroundColor: `${t.acento}26` }]}
    >
      <View style={e.filaChip}>
        <SymbolView name={destino.icono} size={16} tintColor={t.acento} fallback={<View />} />
        <Text variant="labelLarge" style={{ color: t.acento }}>{destino.texto}</Text>
      </View>
    </TouchableRipple>
  );
  return (
    <View accessibilityRole="header" accessibilityLabel={actual.texto} style={e.fila}>
      {sentido === 'adelante' ? pantalla(actual) : chip}
      <Icono nombre={sentido === 'adelante' ? 'flecha' : 'flechaIzq'} tamano={14} color={t.suave} />
      {sentido === 'adelante' ? chip : pantalla(actual)}
    </View>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  pantalla: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  circulo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actual: { flexShrink: 1 },
  // Chip de Material 3: 32 de alto y esquinas de 8.
  chip: { minHeight: 32, borderRadius: 8, justifyContent: 'center', paddingHorizontal: espacio.m },
  filaChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
