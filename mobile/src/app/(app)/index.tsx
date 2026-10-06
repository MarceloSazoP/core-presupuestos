import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { INICIO } from '@/lib/montos';
import { BotonOjo } from '@/components/boton-ojo';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Resumen } from '@/components/resumen';
import { Sincronizacion } from '@/components/sincronizacion';
import { TituloBloque } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Inicio (primera pantalla): cómo va el mes, a quién contactar hoy y, junto al título «Resumen», «Nuevo presupuesto». La lista con sus pestañas por estado
// se abre desde el ícono de la barra de arriba (presupuestos.tsx).
export default function Inicio() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [actualizar, setActualizar] = useState(0); // al cambiar, el resumen se vuelve a pedir
  const [refrescando, setRefrescando] = useState(false);
  // Cada vez que se llega a Inicio (deslizando, con el título o al volver) el resumen entra de nuevo con sus animaciones.
  const [ronda, setRonda] = useState(0);
  const primera = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primera.current) primera.current = false; // la primera vez ya anima al abrirse
      else setRonda((r) => r + 1);
    }, []),
  );
  // Deslizar hacia la izquierda en el inicio lleva a la lista de presupuestos (como pasar a la página siguiente). Pide un gesto claramente
  // horizontal para no pelear con el desplazamiento vertical ni con «deslizar para actualizar».
  const alLista = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((ev) => {
      if (ev.translationX + ev.velocityX * 0.15 < -70) {
        void Haptics.selectionAsync();
        router.push('/presupuestos');
      }
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <GestureDetector gesture={alLista}>
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
        {/* «Resumen» y, a la derecha, el ojo que oculta los montos del inicio. */}
        <View style={e.titulo}>
          <TituloBloque titulo="Resumen" icono="tendencia" />
          <BotonOjo clave={INICIO} />
        </View>
        {/* al deslizar para actualizar, cambia la clave y se vuelve a pedir */}
        <Resumen key={actualizar} ronda={ronda} />
      </ScrollView>
      </GestureDetector>
    </View>
  );
}

const e = StyleSheet.create({
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  nuevo: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: espacio.xs, borderRadius: 17, paddingHorizontal: espacio.m },
  textoNuevo: { fontSize: 14, fontWeight: '600' },
  titulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
});
