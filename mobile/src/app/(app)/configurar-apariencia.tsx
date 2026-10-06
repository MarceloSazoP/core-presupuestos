import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { PestanasParte } from '@/components/pestanas-parte';
import { Seccion, type NombreIcono } from '@/components/ui';
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
      <Seccion titulo="Apariencia" icono="luna" descripcion="Automático sigue el modo claro u oscuro de tu teléfono.">
        <PestanasParte
          partes={OPCIONES_TEMA.map((o) => ({ id: o.id, texto: o.texto, icono: ICONO_TEMA[o.id] }))}
          valor={tema}
          etiqueta="Apariencia de la app"
          alElegir={(id) => {
            const p = id as PreferenciaTema;
            setTema(p);
            void elegirTema(p);
          }}
        />
      </Seccion>
    </ScrollView>
  );
}

const e = StyleSheet.create({ contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl } });
