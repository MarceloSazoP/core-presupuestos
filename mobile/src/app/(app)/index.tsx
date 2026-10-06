import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Resumen } from '@/components/resumen';
import { Sincronizacion } from '@/components/sincronizacion';
import { Icono, Texto } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Inicio (primera pantalla): cómo va el mes, a quién contactar hoy y, junto al título «Resumen», «Nuevo presupuesto». La lista con sus pestañas por estado
// se abre desde el ícono de la barra de arriba (presupuestos.tsx).
export default function Inicio() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [actualizar, setActualizar] = useState(0); // al cambiar, el resumen se vuelve a pedir
  const [refrescando, setRefrescando] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: espacio.l, gap: espacio.l, paddingBottom: insets.bottom + espacio.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              setActualizar((n) => n + 1);
              setTimeout(() => setRefrescando(false), 600);
            }}
          />
        }
      >
        <Sincronizacion />
        {/* «Resumen» y, a su lado, el botón para crear: siempre a la vista, aunque todavía no haya datos que mostrar. */}
        <View style={e.titulo}>
          <Texto variante="subtitulo" accessibilityRole="header">Resumen</Texto>
          <Pressable accessibilityRole="button" accessibilityLabel="Nuevo presupuesto" onPress={() => router.push('/nuevo')} hitSlop={8} style={({ pressed }) => [e.nuevo, { backgroundColor: `${t.acento}1A`, opacity: pressed ? 0.6 : 1 }]}>
            <Icono nombre="documentoNuevo" tamano={16} color={t.acento} />
            <Text style={[e.textoNuevo, { color: t.acento }]}>Nuevo</Text>
          </Pressable>
        </View>
        {/* al deslizar para actualizar, cambia la clave y se vuelve a pedir */}
        <Resumen key={actualizar} />
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  nuevo: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: espacio.xs, borderRadius: 17, paddingHorizontal: espacio.m },
  textoNuevo: { fontSize: 14, fontWeight: '600' },
  titulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
});
