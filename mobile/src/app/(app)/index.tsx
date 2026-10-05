import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Resumen } from '@/components/resumen';
import { Sincronizacion } from '@/components/sincronizacion';
import { Boton } from '@/components/ui';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Inicio (primera pantalla): cómo va el mes, a quién contactar hoy y «Crear presupuesto». La lista con sus pestañas por estado
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
        contentContainerStyle={{ padding: espacio.l, gap: espacio.l, paddingBottom: insets.bottom + MIN_TOQUE + espacio.xxl * 2 }}
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
        <Resumen key={actualizar} /> {/* al deslizar para actualizar, cambia la clave y se vuelve a pedir */}
      </ScrollView>
      <View pointerEvents="box-none" style={[e.cta, { paddingBottom: insets.bottom + espacio.m }]}>
        <Boton titulo="Crear presupuesto" icono="mas" onPress={() => router.push('/nuevo')} />
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: espacio.l },
});
