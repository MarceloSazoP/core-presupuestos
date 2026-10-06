import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Título de la barra que también es un botón entre dos pantallas, para no tener un botón aparte:
// - hacia adelante: «Inicio → Presupuestos» (la pantalla actual y, en una pastilla, a dónde se va);
// - hacia atrás: «Inicio ← Presupuestos» (la pastilla, a la izquierda, es la pantalla a la que se vuelve; la actual queda a la derecha).
// Cada pantalla lleva su ícono, también la de la pastilla.
type Pantalla = { texto: string; icono: SymbolViewProps['name'] };

export function TituloIr({ actual, destino, sentido, alIr }: { actual: Pantalla; destino: Pantalla; sentido: 'adelante' | 'atras'; alIr: () => void }) {
  const t = useTema();
  const pantalla = (p: Pantalla) => (
    <View style={e.pantalla}>
      <SymbolView name={p.icono} size={20} tintColor={t.acento} fallback={<View />} />
      <Text style={[e.actual, { color: t.texto }]}>{p.texto}</Text>
    </View>
  );
  const pastilla = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${destino.texto}`}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        alIr();
      }}
      style={({ pressed }) => [e.destino, { backgroundColor: `${t.acento}1A`, opacity: pressed ? 0.6 : 1 }]}
    >
      <SymbolView name={destino.icono} size={16} tintColor={t.acento} fallback={<View />} />
      <Text style={[e.textoDestino, { color: t.acento }]}>{destino.texto}</Text>
    </Pressable>
  );
  return (
    <View accessibilityRole="header" accessibilityLabel={actual.texto} style={e.fila}>
      {sentido === 'adelante' ? pantalla(actual) : pastilla}
      <Icono nombre={sentido === 'adelante' ? 'flecha' : 'flechaIzq'} tamano={14} color={t.suave} />
      {sentido === 'adelante' ? pastilla : pantalla(actual)}
    </View>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  pantalla: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  actual: { fontSize: 17, fontWeight: '600' },
  destino: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30, borderRadius: 15, paddingHorizontal: espacio.m },
  textoDestino: { fontSize: 14, fontWeight: '600' },
});
