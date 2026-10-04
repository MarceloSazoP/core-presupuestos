import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Texto } from '@/components/ui';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, MIN_TOQUE, useTema, type Tema } from '@/theme';

// Cada pestaña es un bloque con el color de su estado (el mismo de las etiquetas de la lista): la elegida va llena y las
// demás con un tinte suave del mismo color. El número arriba, el nombre abajo. La barra siempre está a la vista aunque la
// lista sea larga; con cinco pestañas se desliza de lado y la elegida se acerca sola.
const COLOR: Record<Pestana, keyof Tema> = { pendientes: 'aviso', enviados: 'ok', seguimiento: 'seguimiento', aceptados: 'acento', rechazados: 'error' };

export function Pestanas({ activa, cuentas, alElegir }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void }) {
  const t = useTema();
  const barra = useRef<ScrollView>(null);
  const posiciones = useRef<Partial<Record<Pestana, number>>>({});

  // Al cambiar de pestaña (o al abrir con una recordada) la barra la deja a la vista.
  useEffect(() => {
    const x = posiciones.current[activa];
    if (x !== undefined) barra.current?.scrollTo({ x: Math.max(0, x - espacio.l), animated: true });
  }, [activa]);

  return (
    <View accessibilityRole="tablist">
      <ScrollView ref={barra} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.barra}>
        {PESTANAS.map((p) => {
          const elegida = p.id === activa;
          const color = t[COLOR[p.id]];
          return (
            <Pressable
              key={p.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: elegida }}
              accessibilityLabel={`${p.texto}, ${cuentas[p.id]}`}
              onLayout={(ev) => {
                posiciones.current[p.id] = ev.nativeEvent.layout.x;
                if (elegida) barra.current?.scrollTo({ x: Math.max(0, ev.nativeEvent.layout.x - espacio.l), animated: false });
              }}
              onPress={() => {
                if (!elegida) void Haptics.selectionAsync();
                alElegir(p.id);
              }}
              style={[e.pestana, { backgroundColor: elegida ? color : `${color}26`, borderColor: color }]}
            >
              <Texto fuerte color={elegida ? 'sobreAcento' : 'texto'} style={e.numero}>{cuentas[p.id]}</Texto>
              <Texto variante="chico" color={elegida ? 'sobreAcento' : 'texto'} fuerte={elegida} numberOfLines={1}>{p.texto}</Texto>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  barra: { gap: espacio.s, paddingHorizontal: espacio.l, paddingVertical: espacio.m },
  pestana: { minWidth: 92, minHeight: MIN_TOQUE + espacio.s, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, borderCurve: 'continuous', paddingVertical: espacio.xs, paddingHorizontal: espacio.m },
  numero: { fontVariant: ['tabular-nums'] },
});
