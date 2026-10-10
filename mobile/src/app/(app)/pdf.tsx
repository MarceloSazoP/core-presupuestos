import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Icono } from '@/components/ui';
import { MIN_TOQUE, useTema } from '@/theme';

// El PDF de un presupuesto en el iPhone (lib/pdf.ts lo descarga y abre esta pantalla): WKWebView lo dibuja como el visor del sistema,
// con zoom y desplazamiento. Arriba a la derecha, compartir el archivo (AirDrop, correo, guardar en Archivos).
export default function VerPdf() {
  const t = useTema();
  const { uri, titulo } = useLocalSearchParams<{ uri: string; titulo?: string }>();
  const carpeta = uri.slice(0, uri.lastIndexOf('/') + 1); // el WebView solo lee archivos de la carpeta que se le permite
  return (
    <View style={[e.flex, { backgroundColor: t.fondo }]}>
      <Stack.Screen
        options={{
          title: titulo ?? 'PDF',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Compartir el PDF" hitSlop={6} onPress={() => void Share.share({ url: uri })} style={e.boton}>
              <Icono nombre="compartir" tamano={22} color={t.acento} />
            </Pressable>
          ),
        }}
      />
      <WebView source={{ uri }} originWhitelist={['*']} allowingReadAccessToURL={carpeta} allowFileAccess style={e.flex} />
    </View>
  );
}

const e = StyleSheet.create({
  flex: { flex: 1 },
  boton: { minWidth: MIN_TOQUE - 8, minHeight: MIN_TOQUE - 8, alignItems: 'center', justifyContent: 'center' },
});
