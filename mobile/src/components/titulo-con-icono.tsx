import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { espacio, useTema } from '@/theme';

// Título de la barra con Material 3: el ícono de la pantalla (el mismo del botón que lleva a ella) en un círculo tonal y el nombre en la
// letra de título de la barra de Material («título grande», 22). `compacto`: para barras con poco espacio (la hoja de Nuevo presupuesto,
// entre «Cancelar» y «Guardar»), en «título medio».
export function TituloConIcono({ texto, icono, compacto }: { texto: string; icono: SymbolViewProps['name']; compacto?: boolean }) {
  const t = useTema();
  const lado = compacto ? 28 : 32;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={texto} style={e.fila}>
      <View style={[e.circulo, { width: lado, height: lado, borderRadius: lado / 2, backgroundColor: `${t.acento}1F` }]}>
        <SymbolView name={icono} size={compacto ? 16 : 18} tintColor={t.acento} fallback={<View />} />
      </View>
      <Text variant={compacto ? 'titleMedium' : 'titleLarge'} numberOfLines={1} style={[e.texto, { color: t.texto }]}>{texto}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  circulo: { alignItems: 'center', justifyContent: 'center' },
  texto: { flexShrink: 1 },
});
