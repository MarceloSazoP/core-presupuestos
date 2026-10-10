import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { CampoM } from '@/components/material';
import { Campo, Icono, Texto } from '@/components/ui';
import { ElegirPais } from '@/components/elegir-pais';
import { bandera, PAISES, paisDelTelefono } from '@/lib/paises';
import { formatearTelefono, plantillaTelefono } from '@/lib/telefono';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Teléfono: el código de país (un botón que abre la lista) y el número. El número se escribe sin código; uno que empiece con «+» se
// respeta tal cual (es de otro país). `codigo` es el prefijo elegido (+56): el formulario lo usa al normalizar el teléfono.
// `material`: el campo con contorno de Material (`CampoM`) y el selector de país del mismo alto, para las pantallas que ya son de Material.
export function CampoTelefono({ codigo, alCodigo, material, ...props }: Omit<ComponentProps<typeof Campo>, 'izquierda' | 'keyboardType'> & { codigo: string; alCodigo: (codigo: string) => void; material?: boolean }) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  // El +1 es de dos países de la lista (República Dominicana y Puerto Rico): la bandera sale del código de área ya escrito y, si
  // todavía no lo dice, del país que se eligió en la lista.
  const [elegido, setElegido] = useState<string>();
  const delCodigo = PAISES.filter((p) => p.calling_code === codigo);
  const actual = paisDelTelefono(codigo + (props.value ?? '').replace(/\D/g, '')) ?? delCodigo.find((p) => p.country === elegido) ?? delCodigo[0];
  const pais = `Código de país: ${actual?.name ?? codigo}, ${codigo}. Cambiar`;
  const { ref: _ref, icono: _icono, selectionColor: _s, placeholderTextColor: _p, cursorColor: _c, selectionHandleColor: _h, ...resto } = props;
  return (
    <>
      {material ? (
        <CampoM
          {...resto}
          value={formatearTelefono(props.value ?? '', codigo)}
          onChangeText={(v) => props.onChangeText?.(formatearTelefono(v, codigo))}
          maxLength={24}
          placeholder={plantillaTelefono(codigo)}
          keyboardType="phone-pad"
          autoComplete="tel"
          izquierda={
            <TouchableRipple accessibilityRole="button" accessibilityLabel={pais} onPress={() => setAbierto(true)} borderless style={[e.selectorM, { borderColor: t.bordeCampo }]}>
              <View style={e.filaSelector}>
                <Text variant="bodyLarge">{actual ? bandera(actual.country) : '🌐'}</Text>
                <Text variant="bodyLarge" style={e.fuerte}>{codigo}</Text>
                <Icono nombre="despliegue" tamano={11} color={t.suave} />
              </View>
            </TouchableRipple>
          }
        />
      ) : (
        <Campo
          {...props}
          // El número se ve con el formato de su país (9 5482 2089) mientras se escribe.
          value={formatearTelefono(props.value ?? '', codigo)}
          onChangeText={(v) => props.onChangeText?.(formatearTelefono(v, codigo))}
          maxLength={24}
          placeholder={plantillaTelefono(codigo)} // la forma del número del país, con X
          keyboardType="phone-pad"
          autoComplete="tel"
          izquierda={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pais}
              onPress={() => setAbierto(true)}
              style={[e.selector, { backgroundColor: t.campo, borderColor: t.bordeCampo }]}
            >
              <Texto>{actual ? bandera(actual.country) : '🌐'}</Texto>
              <Texto fuerte>{codigo}</Texto>
              <Icono nombre="despliegue" tamano={11} color={t.suave} />
            </Pressable>
          }
        />
      )}
      {abierto ? (
        <ElegirPais
          titulo="Código de país"
          detalle={(p) => p.calling_code}
          actual={actual?.country ?? ''}
          alElegir={(c) => {
            const nuevo = PAISES.find((p) => p.country === c)!.calling_code;
            setElegido(c);
            alCodigo(nuevo);
            props.onChangeText?.(formatearTelefono(props.value ?? '', nuevo)); // lo ya escrito toma el formato del nuevo país
            setAbierto(false);
          }}
          alCerrar={() => setAbierto(false)}
        />
      ) : null}
    </>
  );
}

const e = StyleSheet.create({
  // A la altura del borde de `CampoM`: Paper dibuja el contorno 6 más abajo que el campo, donde flota la etiqueta.
  selectorM: { marginTop: 6, justifyContent: 'center', borderWidth: 1, borderRadius: radio.s, paddingHorizontal: espacio.m, minWidth: MIN_TOQUE },
  filaSelector: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2 },
  fuerte: { fontWeight: '600' },
  selector: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.m },
});
