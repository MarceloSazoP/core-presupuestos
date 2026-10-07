import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';
import { SeccionM, TarjetaM } from '@/components/material';
import { espacio, useTema } from '@/theme';

const AÑO_DE_CREACION = 2026;

// Información: la versión de la app y quién la creó.
export default function Informacion() {
  const t = useTema();
  const fila = (k: string, v: string | number) => (
    <View style={e.fila}>
      <Text variant="bodyLarge" style={{ color: t.suave }}>{k}</Text>
      <Text variant="titleMedium" style={e.valor}>{v}</Text>
    </View>
  );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <SeccionM titulo="Acerca de" icono="info">
        <TarjetaM sinRelleno>
          {fila('Versión', Constants.expoConfig?.version ?? '—')}
          <Divider />
          {fila('Creada por', 'CORE Tecnología Empresarial')}
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
});
