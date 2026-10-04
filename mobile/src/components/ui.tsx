import { ActivityIndicator, InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import { espacio, letra, MIN_TOQUE, useTema, type Tema } from '@/theme';

// Piezas mínimas de interfaz. Tamaños de letra: 4; pesos: 2 (400 y 600). Todo objetivo táctil mide ≥ 48 pt.
type Variante = 'titulo' | 'subtitulo' | 'cuerpo' | 'chico';
const ESTILO_TEXTO: Record<Variante, { fontSize: number; fontWeight: '400' | '600'; lineHeight: number }> = {
  titulo: { fontSize: letra.titulo, fontWeight: '600', lineHeight: 34 },
  subtitulo: { fontSize: letra.subtitulo, fontWeight: '600', lineHeight: 26 },
  cuerpo: { fontSize: letra.cuerpo, fontWeight: '400', lineHeight: 22 },
  chico: { fontSize: letra.chico, fontWeight: '400', lineHeight: 18 },
};

export function Texto({ variante = 'cuerpo', suave, fuerte, color, style, ...props }: TextProps & { variante?: Variante; suave?: boolean; fuerte?: boolean; color?: keyof Tema }) {
  const t = useTema();
  return <Text {...props} style={[ESTILO_TEXTO[variante], { color: t[color ?? (suave ? 'suave' : 'texto')] }, fuerte ? { fontWeight: '600' } : null, style]} />;
}

export function Boton({ titulo, variante = 'primario', cargando = false, disabled, style, ...props }: Omit<PressableProps, 'children'> & { titulo: string; variante?: 'primario' | 'secundario' | 'texto'; cargando?: boolean }) {
  const t = useTema();
  const inactivo = disabled || cargando;
  const primario = variante === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: cargando }}
      disabled={inactivo}
      {...props}
      style={({ pressed }) => [
        e.boton,
        primario && { backgroundColor: t.acento },
        variante === 'secundario' && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.borde, backgroundColor: t.tarjeta },
        { opacity: inactivo ? 0.5 : pressed ? 0.75 : 1 },
        typeof style === 'function' ? undefined : style,
      ]}
    >
      {cargando ? <ActivityIndicator color={primario ? t.sobreAcento : t.texto} /> : null}
      <Text style={[e.textoBoton, { color: primario ? t.sobreAcento : variante === 'texto' ? t.acento : t.texto }]}>{titulo}</Text>
    </Pressable>
  );
}

// Barra fija sobre el teclado de iOS (se monta una sola vez en la raíz): el botón «Listo» lo oculta y la barrita indica que se
// puede arrastrar hacia abajo (las pantallas con campos usan keyboardDismissMode="interactive"). El teclado numérico de iOS no
// trae tecla para cerrarse, así que sin esto un campo de precio dejaba el teclado abierto.
export const TECLADO_ID = 'barraTeclado';

export function BarraTeclado() {
  const t = useTema();
  if (Platform.OS !== 'ios') return null; // en Android el gesto o el botón atrás ya ocultan el teclado
  return (
    <InputAccessoryView nativeID={TECLADO_ID}>
      <View style={[e.barraTeclado, { backgroundColor: t.tarjeta, borderTopColor: t.borde }]}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[e.agarreTeclado, { backgroundColor: t.suave }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Ocultar teclado" onPress={() => Keyboard.dismiss()} hitSlop={8} style={e.listo}>
          <Text style={[e.textoBoton, { color: t.acento }]}>Listo</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function Campo({ etiqueta, error, ayuda, ref, style, ...props }: TextInputProps & { etiqueta: string; error?: string | null; ayuda?: string; ref?: React.Ref<TextInput> }) {
  const t = useTema();
  return (
    <View style={e.campo}>
      <Texto variante="chico" fuerte>
        {etiqueta}
      </Texto>
      <TextInput
        ref={ref}
        accessibilityLabel={etiqueta}
        inputAccessoryViewID={TECLADO_ID}
        placeholderTextColor={t.suave}
        selectionColor={t.acento}
        {...props}
        style={[e.entrada, { color: t.texto, backgroundColor: t.tarjeta, borderColor: error ? t.error : t.borde }, props.multiline ? e.multilinea : null, style]}
      />
      {error ? (
        <Texto variante="chico" color="error" accessibilityRole="alert">
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto variante="chico" suave>
          {ayuda}
        </Texto>
      ) : null}
    </View>
  );
}

export function Pastilla({ texto, tono }: { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'seguimiento' | 'error' }) {
  const t = useTema();
  const color = t[tono];
  return (
    <View style={[e.pastilla, { borderColor: color }]}>
      <View style={[e.punto, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: letra.chico, fontWeight: '600' }}>{texto}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  boton: { minHeight: MIN_TOQUE, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: espacio.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s },
  textoBoton: { fontSize: letra.cuerpo, fontWeight: '600' },
  campo: { gap: espacio.xs },
  barraTeclado: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: espacio.l },
  agarreTeclado: { position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -20, top: 6, width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  listo: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  entrada: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: espacio.l, fontSize: letra.cuerpo }, // 16 pt: iOS no hace zoom al enfocar
  multilinea: { minHeight: 96, paddingTop: espacio.m, textAlignVertical: 'top' },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: espacio.m, paddingVertical: espacio.xs },
  punto: { width: 8, height: 8, borderRadius: 4 },
});
