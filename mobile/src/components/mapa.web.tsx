import { useImperativeHandle, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// En la web (solo desarrollo) no hay mapa nativo: un recuadro que lo dice, y el resto del formulario sigue funcionando.
type Props = { style?: StyleProp<ViewStyle>; children?: ReactNode; ref?: Ref<{ animateToRegion: () => void }> } & Record<string, unknown>;

export default function MapView({ style, ref }: Props) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => {} }), []);
  return (
    <View style={[style, e.caja]}>
      <Text style={e.texto}>El mapa se ve en la app del teléfono.</Text>
    </View>
  );
}

export const Marker = (_: Record<string, unknown>) => null;

const e = StyleSheet.create({
  caja: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E8E8' },
  texto: { color: '#5D5A57', fontSize: 14 },
});
