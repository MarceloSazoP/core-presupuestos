import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Campo, Icono, Texto } from '@/components/ui';
import { ElegirPais } from '@/components/elegir-pais';
import { bandera, PAISES } from '@/lib/paises';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Teléfono: el código de país (un botón que abre la lista) y el número. El número se escribe sin código; uno que empiece con «+» se
// respeta tal cual (es de otro país). `codigo` es el prefijo elegido (+56): el formulario lo usa al normalizar el teléfono.
export function CampoTelefono({ codigo, alCodigo, ...props }: Omit<ComponentProps<typeof Campo>, 'izquierda' | 'keyboardType'> & { codigo: string; alCodigo: (codigo: string) => void }) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const actual = PAISES.find((p) => p.calling_code === codigo);
  return (
    <>
      <Campo
        {...props}
        keyboardType="phone-pad"
        autoComplete="tel"
        izquierda={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Código de país: ${actual?.name ?? codigo}, ${codigo}. Cambiar`}
            onPress={() => setAbierto(true)}
            style={[e.selector, { backgroundColor: t.campo, borderColor: t.bordeCampo }]}
          >
            <Texto>{actual ? bandera(actual.country) : '🌐'}</Texto>
            <Texto fuerte>{codigo}</Texto>
            <Icono nombre="despliegue" tamano={11} color={t.suave} />
          </Pressable>
        }
      />
      {abierto ? (
        <ElegirPais
          titulo="Código de país"
          detalle={(p) => p.calling_code}
          actual={actual?.country ?? ''}
          alElegir={(c) => {
            alCodigo(PAISES.find((p) => p.country === c)!.calling_code);
            setAbierto(false);
          }}
          alCerrar={() => setAbierto(false)}
        />
      ) : null}
    </>
  );
}

const e = StyleSheet.create({
  selector: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.m },
});
