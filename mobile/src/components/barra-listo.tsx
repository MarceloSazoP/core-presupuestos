import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Texto } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Barra «Listo» pegada arriba del teclado, para las pantallas que se abren como hoja o modal. Esas son otra ventana nativa y la barra
// de la raíz (InputAccessoryView) no llega hasta ahí; esta sigue al teclado y funciona con el numérico, que no trae tecla para cerrarse.
// Va como último hijo de una vista que ocupa toda la pantalla. Solo iPhone: en Android el gesto o el botón atrás ya ocultan el teclado.
export function BarraListo() {
  const t = useTema();
  const [teclado, setTeclado] = useState(0); // alto del teclado en pantalla; 0 = oculto
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const a = Keyboard.addListener('keyboardWillChangeFrame', (ev) => setTeclado(ev.endCoordinates.screenY >= Dimensions.get('window').height ? 0 : ev.endCoordinates.height));
    const b = Keyboard.addListener('keyboardWillHide', () => setTeclado(0));
    return () => (a.remove(), b.remove());
  }, []);
  if (!teclado) return null;
  return (
    <View style={[e.barra, { bottom: teclado, backgroundColor: t.tarjeta, borderTopColor: t.borde }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ocultar teclado" onPress={() => Keyboard.dismiss()} hitSlop={8} style={[e.listo, { backgroundColor: t.acento }]}>
        <Texto color="sobreAcento" fuerte>Listo</Texto>
      </Pressable>
    </View>
  );
}

const e = StyleSheet.create({
  barra: { position: 'absolute', left: 0, right: 0, minHeight: 56, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: espacio.l, borderTopWidth: StyleSheet.hairlineWidth },
  listo: { minHeight: MIN_TOQUE - 4, minWidth: 96, borderRadius: radio.m, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: espacio.l },
});
