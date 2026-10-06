import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, View } from 'react-native';
import { espacio, useTema } from '@/theme';

// Título de la barra con su ícono al lado (el mismo del botón que lleva a esa pantalla).
export function TituloConIcono({ texto, icono }: { texto: string; icono: SymbolViewProps['name'] }) {
  const t = useTema();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={texto} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
      <SymbolView name={icono} size={20} tintColor={t.acento} fallback={<View />} />
      <Text style={{ color: t.texto, fontSize: 17, fontWeight: '600' }}>{texto}</Text>
    </View>
  );
}
