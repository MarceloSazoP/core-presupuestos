import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { SeccionM } from '@/components/material';
import { Icono, type NombreIcono } from '@/components/ui';
import { elegirTema, leerPreferenciaTema, OPCIONES_TEMA, type PreferenciaTema } from '@/lib/preferencia-tema';
import { espacio, useTema } from '@/theme';

const ICONO_TEMA: Record<PreferenciaTema, NombreIcono> = { sistema: 'sistema', claro: 'sol', oscuro: 'luna' };

// Apariencia: Automático, Claro u Oscuro. Es la única «pestaña» que queda en Configurar.
export default function Apariencia() {
  const t = useTema();
  const [tema, setTema] = useState<PreferenciaTema>('sistema');
  useEffect(() => void leerPreferenciaTema().then(setTema), []);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <SeccionM titulo="Apariencia" icono="luna" descripcion="Automático sigue el modo claro u oscuro de tu teléfono.">
        {/* Botones segmentados de Material 3: la opción elegida queda marcada con el tono del acento. */}
        <SegmentedButtons
          value={tema}
          onValueChange={(id) => {
            const p = id as PreferenciaTema;
            setTema(p);
            void elegirTema(p);
          }}
          buttons={OPCIONES_TEMA.map((o) => ({
            value: o.id,
            label: o.texto,
            accessibilityLabel: `Apariencia: ${o.texto}`,
            icon: ({ size, color }: { size: number; color: string }) => <Icono nombre={ICONO_TEMA[o.id]} tamano={size} color={color} />,
            style: e.segmento,
          }))}
        />
      </SeccionM>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  segmento: { minHeight: 48, justifyContent: 'center' },
});
