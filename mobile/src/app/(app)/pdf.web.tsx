import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TextoM } from '@/components/material';
import { espacio, useTema } from '@/theme';

// En la web de desarrollo no hay WebView nativo (react-native-webview rompería todo el paquete web): ver el PDF es cosa del teléfono.
export default function VerPdf() {
  const t = useTema();
  return (
    <View style={[e.centro, { backgroundColor: t.fondo }]}>
      <Stack.Screen options={{ title: 'PDF' }} />
      <TextoM suave>El PDF se ve en la app del teléfono.</TextoM>
    </View>
  );
}

const e = StyleSheet.create({ centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl } });
