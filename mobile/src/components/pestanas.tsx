import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Texto } from '@/components/ui';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, MIN_TOQUE, useTema, type Tema } from '@/theme';

// Cada pestaña es un bloque con el color de su estado (el mismo de las etiquetas de la lista): la elegida va llena y las
// demás con un tinte suave del mismo color. El número arriba, el nombre abajo. Siempre a la vista, aunque la lista sea larga.
const COLOR: Record<Pestana, keyof Tema> = { pendientes: 'aviso', enviados: 'ok', aceptados: 'acento', rechazados: 'error' };

export function Pestanas({ activa, cuentas, alElegir }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void }) {
  const t = useTema();
  return (
    <View accessibilityRole="tablist" style={e.barra}>
      {PESTANAS.map((p) => {
        const elegida = p.id === activa;
        const color = t[COLOR[p.id]];
        return (
          <Pressable
            key={p.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: elegida }}
            accessibilityLabel={`${p.texto}, ${cuentas[p.id]}`}
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
    </View>
  );
}

const e = StyleSheet.create({
  barra: { flexDirection: 'row', gap: espacio.s, paddingHorizontal: espacio.l, paddingVertical: espacio.m },
  pestana: { flex: 1, minHeight: MIN_TOQUE + espacio.s, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, borderCurve: 'continuous', paddingVertical: espacio.xs },
  numero: { fontVariant: ['tabular-nums'] },
});
