import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icono, Presionable, Tarjeta, Texto } from '@/components/ui';
import { borrarAvisos, marcarLeido, useAvisos } from '@/lib/avisos';
import { sinLeer } from '@/lib/avisos-datos';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Avisos: los que le llegan al teléfono (recordatorios de contacto), también dentro de la app. Tocar uno abre su presupuesto.
function cuando(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dif = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - dia) / 86_400_000);
  const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dif <= 0) return `Hoy ${hora}`;
  if (dif === 1) return `Ayer ${hora}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function Avisos() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const avisos = useAvisos();
  const nuevos = sinLeer(avisos);
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            avisos.length ? (
              <Pressable accessibilityRole="button" accessibilityLabel={nuevos ? 'Marcar todos como leídos' : 'Borrar los avisos'} onPress={() => void (nuevos ? marcarLeido() : borrarAvisos())} hitSlop={8} style={e.accion}>
                <Texto color="acento">{nuevos ? 'Marcar leídos' : 'Borrar'}</Texto>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={{ padding: espacio.l, paddingBottom: insets.bottom + espacio.xxl, gap: espacio.m }}>
        {avisos.length ? (
          <Tarjeta style={e.lista}>
            {avisos.map((a, n) => (
              <Presionable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.titulo}. ${a.cuerpo}. ${cuando(a.fecha)}${a.leido ? '' : '. Sin leer'}`}
                onPress={() => {
                  void marcarLeido(a.id);
                  if (a.quoteId) router.push({ pathname: '/presupuesto/[id]', params: { id: a.quoteId } });
                }}
                estilo={[e.fila, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }]}
              >
                <View style={[e.punto, { backgroundColor: a.leido ? 'transparent' : t.acento }]} />
                <View style={e.flex}>
                  <Texto fuerte={!a.leido}>{a.titulo}</Texto>
                  {a.cuerpo ? <Texto variante="chico" suave>{a.cuerpo}</Texto> : null}
                  <Texto variante="chico" suave>{cuando(a.fecha)}</Texto>
                </View>
                {a.quoteId ? <Icono nombre="despliegue" tamano={12} color={t.suave} /> : null}
              </Presionable>
            ))}
          </Tarjeta>
        ) : (
          <View style={e.vacio}>
            <View style={[e.vacioIcono, { backgroundColor: `${t.suave}1A` }]}>
              <Icono nombre="reloj" tamano={30} color={t.suave} />
            </View>
            <Texto variante="subtitulo" style={e.centrado}>Sin avisos</Texto>
            <Texto suave style={e.centrado}>Aquí quedan los avisos que te llegan al teléfono, como el recordatorio de contactar a un cliente.</Texto>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const e = StyleSheet.create({
  accion: { minHeight: MIN_TOQUE, justifyContent: 'center' },
  lista: { padding: 0, gap: 0, overflow: 'hidden' },
  fila: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.m, paddingHorizontal: espacio.l },
  punto: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1, gap: 2 },
  vacio: { alignItems: 'center', gap: espacio.s, paddingTop: espacio.xxl * 2, paddingHorizontal: espacio.xl },
  vacioIcono: { width: 64, height: 64, borderRadius: radio.l, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginBottom: espacio.s },
  centrado: { textAlign: 'center' },
});
