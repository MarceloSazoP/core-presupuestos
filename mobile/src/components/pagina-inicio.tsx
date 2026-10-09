import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import { OjoTonal } from '@/components/boton-ojo';
import { Resumen } from '@/components/resumen';
import { Sincronizacion } from '@/components/sincronizacion';
import { Icono } from '@/components/ui';
import { INICIO } from '@/lib/montos';
import { espacio, useTema } from '@/theme';

// La página de Inicio (index.tsx la pone junto a la de Presupuestos, bajo la misma barra): cómo va el mes y a quién contactar hoy.
// - `activa`: si es la página que se ve. Cada vez que se llega a ella (deslizando, desde el menú o al volver de otra pantalla) las barras
//   del gráfico vuelven a crecer; los números quedan quietos.
// - `alPresupuestos`: deslizar hacia la izquierda pasa a Presupuestos (la página siguiente).
// - `abajo`: lo que tapa el botón de «Nuevo presupuesto»; el contenido termina sobre él.
export function PaginaInicio({ activa, alPresupuestos, abajo }: { activa: boolean; alPresupuestos: () => void; abajo: number }) {
  const t = useTema();
  const [actualizar, setActualizar] = useState(0); // al cambiar, el resumen se vuelve a pedir
  const [refrescando, setRefrescando] = useState(false);
  const [ronda, setRonda] = useState(0);
  const primera = useRef(true);
  // Corre al enfocar la pantalla y otra vez cada vez que cambia `activa` mientras está enfocada (al pasar de una página a otra).
  useFocusEffect(
    useCallback(() => {
      if (primera.current) {
        primera.current = false; // la primera vez ya anima al abrirse
        return;
      }
      if (activa) setRonda((r) => r + 1);
    }, [activa]),
  );
  // Pide un gesto claramente horizontal para no pelear con el desplazamiento vertical ni con «deslizar para actualizar».
  const alLista = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((ev) => {
      if (ev.translationX + ev.velocityX * 0.15 < -70) {
        void Haptics.selectionAsync();
        alPresupuestos();
      }
    });

  return (
    <GestureDetector gesture={alLista}>
      <ScrollView
        contentContainerStyle={[e.contenido, { paddingBottom: abajo + espacio.l }]}
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
          {/* «Resumen» en el título grande de Material 3, con su ícono en un círculo tonal. */}
          <View style={e.izquierda}>
            <View style={[e.iconoTitulo, { backgroundColor: `${t.acento}1F` }]}><Icono nombre="tendencia" tamano={20} color={t.acento} /></View>
            <Text variant="titleLarge" accessibilityRole="header">Resumen</Text>
          </View>
          <OjoTonal clave={INICIO} />
        </View>
        {/* al deslizar para actualizar, cambia la clave y se vuelve a pedir */}
        <Resumen key={actualizar} ronda={ronda} />
      </ScrollView>
    </GestureDetector>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, gap: espacio.l },
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  iconoTitulo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
});
