import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Texto } from '@/components/ui';
import { PESTANAS, type Pestana } from '@/lib/pestanas';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Pestañas fijas de la lista (siempre a la vista, aunque la lista sea larga): el número arriba, el nombre abajo.
export function Pestanas({ activa, cuentas, alElegir }: { activa: Pestana; cuentas: Record<Pestana, number>; alElegir: (p: Pestana) => void }) {
  const t = useTema();
  return (
    <View accessibilityRole="tablist" style={[e.barra, { borderBottomColor: t.borde }]}>
      {PESTANAS.map((p) => {
        const elegida = p.id === activa;
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
            style={[e.pestana, { borderBottomColor: elegida ? t.acento : 'transparent' }]}
          >
            <Texto fuerte color={elegida ? 'acento' : 'texto'} style={e.numero}>{cuentas[p.id]}</Texto>
            <Texto variante="chico" color={elegida ? 'acento' : 'suave'} fuerte={elegida} numberOfLines={1}>{p.texto}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const e = StyleSheet.create({
  barra: { flexDirection: 'row', paddingHorizontal: espacio.s, borderBottomWidth: StyleSheet.hairlineWidth },
  pestana: { flex: 1, minHeight: MIN_TOQUE + espacio.s, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, paddingVertical: espacio.xs },
  numero: { fontVariant: ['tabular-nums'] },
});
