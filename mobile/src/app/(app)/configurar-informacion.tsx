import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Seccion, Tarjeta, Texto } from '@/components/ui';
import { espacio, useTema } from '@/theme';

const AÑO_DE_CREACION = 2026;

// Información: la versión de la app y quién la creó.
export default function Informacion() {
  const t = useTema();
  const fila = (k: string, v: string | number, primera = false) => (
    <View style={[e.fila, !primera && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde, paddingTop: espacio.m }]}>
      <Texto suave>{k}</Texto>
      <Texto fuerte style={e.valor}>{v}</Texto>
    </View>
  );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Seccion titulo="Acerca de" icono="info">
        <Tarjeta>
          {fila('Versión', Constants.expoConfig?.version ?? '—', true)}
          {fila('Creada por', 'CORE Tecnología Empresarial')}
          {fila('Año', AÑO_DE_CREACION)}
        </Tarjeta>
      </Seccion>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  fila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
  valor: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
