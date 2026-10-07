import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Text, TouchableRipple } from 'react-native-paper';
import { SeccionM, TarjetaM } from '@/components/material';
import { Icono } from '@/components/ui';
import { avisar } from '@/lib/toast';
import { espacio, useTema } from '@/theme';

const AÑO_DE_CREACION = 2026;
const SITIO_WEB = 'www.corepresupuestos.cl';
const SITIO_EMPRESA = 'www.coretecnologia.cl';

// Información: la versión de la app, quién la creó y sus sitios web. Tocar un sitio lo abre en el navegador dentro de la app.
export default function Informacion() {
  const t = useTema();
  const fila = (k: string, v: string | number) => (
    <View style={e.fila}>
      <Text variant="bodyLarge" style={{ color: t.suave }}>{k}</Text>
      <Text variant="titleMedium" style={e.valor}>{v}</Text>
    </View>
  );
  const enlace = (k: string, sitio: string) => (
    <TouchableRipple
      accessibilityRole="link"
      accessibilityLabel={`${k}: ${sitio}. Abrir`}
      rippleColor={`${t.acento}29`}
      onPress={() => void WebBrowser.openBrowserAsync(`https://${sitio}`).catch(() => avisar.error('No se pudo abrir el sitio', sitio))}
    >
      <View style={e.fila}>
        <Text variant="bodyLarge" style={{ color: t.suave }}>{k}</Text>
        <View style={e.derecha}>
          <Text variant="titleMedium" numberOfLines={1} style={[e.valor, { color: t.acento }]}>{sitio}</Text>
          <Icono nombre="exportar" tamano={16} color={t.acento} />
        </View>
      </View>
    </TouchableRipple>
  );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <SeccionM titulo="Acerca de" icono="info">
        <TarjetaM sinRelleno>
          {fila('Versión', Constants.expoConfig?.version ?? '—')}
          <Divider />
          {enlace('Sitio web', SITIO_WEB)}
          <Divider />
          {fila('Creada por', 'CORE Tecnología Empresarial')}
          <Divider />
          {enlace('Empresa', SITIO_EMPRESA)}
          <Divider />
          {fila('Año', AÑO_DE_CREACION)}
        </TarjetaM>
      </SeccionM>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  fila: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m, paddingHorizontal: espacio.l },
  valor: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  derecha: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
