import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { espacio, letra, MIN_TOQUE, radio, useTema, type Color } from '@/theme';

// Piezas de interfaz. Tamaños de letra: 4; pesos: 2 (400 y 600). Todo objetivo táctil mide ≥ 48 pt.
type Variante = 'titulo' | 'subtitulo' | 'cuerpo' | 'chico';
const ESTILO_TEXTO: Record<Variante, { fontSize: number; fontWeight: '400' | '600'; lineHeight: number; letterSpacing?: number }> = {
  titulo: { fontSize: letra.titulo, fontWeight: '600', lineHeight: 34, letterSpacing: -0.4 },
  subtitulo: { fontSize: letra.subtitulo, fontWeight: '600', lineHeight: 26, letterSpacing: -0.2 },
  cuerpo: { fontSize: letra.cuerpo, fontWeight: '400', lineHeight: 22 },
  chico: { fontSize: letra.chico, fontWeight: '400', lineHeight: 18 },
};

export function Texto({ variante = 'cuerpo', suave, fuerte, color, style, ...props }: TextProps & { variante?: Variante; suave?: boolean; fuerte?: boolean; color?: Color }) {
  const t = useTema();
  return <Text {...props} style={[ESTILO_TEXTO[variante], { color: t[color ?? (suave ? 'suave' : 'texto')] }, fuerte ? { fontWeight: '600' } : null, style]} />;
}

// Íconos del sistema: SF Symbols en iOS y Material Symbols en Android y web (expo-symbols). Cada uno con su nombre en las dos
// familias; si falta, queda un hueco del mismo tamaño y nada se descuadra.
const ICONOS = {
  mas: { ios: 'plus', android: 'add', web: 'add' },
  lapiz: { ios: 'pencil', android: 'edit', web: 'edit' },
  copiar: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  compartir: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  camara: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  galeria: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  microfono: { ios: 'mic', android: 'mic', web: 'mic' },
  detener: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  reproducir: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pausar: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  cerrar: { ios: 'xmark', android: 'close', web: 'close' },
  candado: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  llamar: { ios: 'phone', android: 'call', web: 'call' },
  mensaje: { ios: 'message', android: 'chat', web: 'chat' },
  correo: { ios: 'envelope', android: 'mail', web: 'mail' },
  calendario: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  listo: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  sincronizar: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  documento: { ios: 'doc.text', android: 'description', web: 'description' },
  regla: { ios: 'ruler', android: 'straighten', web: 'straighten' },
  ajustes: { ios: 'gearshape', android: 'settings', web: 'settings' },
  alerta: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  reloj: { ios: 'clock', android: 'schedule', web: 'schedule' },
} as const;
export type NombreIcono = keyof typeof ICONOS;

export function Icono({ nombre, tamano = 20, color }: { nombre: NombreIcono; tamano?: number; color: string }) {
  return <SymbolView name={ICONOS[nombre]} size={tamano} tintColor={color} fallback={<View style={{ width: tamano, height: tamano }} />} />;
}

// Curva de salida fuerte para la presión. En iOS y Android, Reanimated solo acepta como texto las curvas predefinidas («ease-out»…): una
// curva propia va con cubicBezier(); el texto 'cubic-bezier(...)' funciona en la web pero en el teléfono lanza un error.
export const CURVA_PRESION = cubicBezier(0.23, 1, 0.32, 1);
// Fuera de StyleSheet.create: sus tipos (los de React Native) solo esperan texto en la curva.
export const TRANSICION_PRESION = { transitionProperty: 'transform', transitionDuration: 120, transitionTimingFunction: CURVA_PRESION } as const;

// Presionar se siente: la pieza se encoge un 3 % en 120 ms (transición CSS de Reanimated, sin estado por cuadro) y vuelve al soltar.
// Con «Reducir movimiento» no se escala. `style` es el del contenedor (ocupa su lugar en la fila); `estilo` el de lo que se ve.
export function Presionable({ style, estilo, children, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'children' | 'style'> & { style?: StyleProp<ViewStyle>; estilo?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [presionado, setPresionado] = useState(false);
  const reducido = useReducedMotion();
  return (
    <Pressable
      pressRetentionOffset={16}
      {...props}
      style={style}
      onPressIn={(ev) => {
        setPresionado(true);
        onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        setPresionado(false);
        onPressOut?.(ev);
      }}
    >
      <Animated.View style={[TRANSICION_PRESION, { transform: [{ scale: presionado && !reducido ? 0.97 : 1 }] }, estilo]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Boton({ titulo, variante = 'primario', icono, cargando = false, disabled, style, ...props }: Omit<PressableProps, 'children' | 'style'> & { titulo: string; variante?: 'primario' | 'secundario' | 'texto'; icono?: NombreIcono; cargando?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  const inactivo = disabled || cargando;
  const primario = variante === 'primario';
  const color = primario ? t.sobreAcento : variante === 'texto' ? t.acento : t.texto;
  return (
    <Presionable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: cargando }}
      disabled={inactivo}
      {...props}
      style={style}
      estilo={[
        e.boton,
        primario && [e.primario, { backgroundColor: t.acento }, !t.oscuro && { boxShadow: `0 4px 14px ${t.acento}40` }],
        variante === 'secundario' && { borderWidth: 1, borderColor: t.borde, backgroundColor: t.tarjeta },
        variante === 'texto' && e.texto,
        { opacity: inactivo ? 0.5 : 1 },
      ]}
    >
      {cargando ? <ActivityIndicator color={color} /> : icono ? <Icono nombre={icono} tamano={18} color={color} /> : null}
      <Text style={[e.textoBoton, { color }]}>{titulo}</Text>
    </Presionable>
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

// Campo con su etiqueta arriba. Relleno gris sobre la tarjeta blanca y borde de 3:1; al escribir, el borde toma el azul de la acción.
export function Campo({ etiqueta, error, ayuda, ref, style, onFocus, onBlur, ...props }: TextInputProps & { etiqueta: string; error?: string | null; ayuda?: string; ref?: React.Ref<TextInput> }) {
  const t = useTema();
  const [enfocado, setEnfocado] = useState(false);
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
        onFocus={(ev) => {
          setEnfocado(true);
          onFocus?.(ev);
        }}
        onBlur={(ev) => {
          setEnfocado(false);
          onBlur?.(ev);
        }}
        style={[e.entrada, { color: t.texto, backgroundColor: t.campo, borderColor: error ? t.error : enfocado ? t.acento : t.bordeCampo }, enfocado || error ? e.entradaActiva : null, props.multiline ? e.multilinea : null, style]}
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

// Estado como etiqueta suave: fondo con un tinte del color y el texto en el color (contraste ≥ 4,5:1 en ambos temas).
export function Pastilla({ texto, tono }: { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'seguimiento' | 'error' }) {
  const t = useTema();
  const color = t[tono];
  return (
    <View style={[e.pastilla, { backgroundColor: `${color}1F` }]}>
      <View style={[e.punto, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: letra.chico, fontWeight: '600' }}>{texto}</Text>
    </View>
  );
}

// Superficie blanca (papel) sobre la página gris. En claro, una sombra muy suave teñida del texto; en oscuro, solo el borde.
export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  return <View style={[e.tarjeta, { backgroundColor: t.tarjeta, borderColor: t.borde }, !t.oscuro && e.sombra, style]}>{children}</View>;
}

// Bloque con título (y, si hace falta, una línea que explica para qué sirve y una acción a la derecha).
export function Seccion({ titulo, descripcion, accion, children, style }: { titulo: string; descripcion?: string; accion?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[e.seccion, style]}>
      <View style={e.cabeceraSeccion}>
        <View style={e.tituloSeccion}>
          <Texto variante="subtitulo" accessibilityRole="header">
            {titulo}
          </Texto>
          {descripcion ? <Texto variante="chico" suave>{descripcion}</Texto> : null}
        </View>
        {accion}
      </View>
      {children}
    </View>
  );
}

// «De la visita»: la copia amarilla del talonario, con el borde de arriba perforado. Es lo único con color propio en la pantalla:
// marca lo que es solo del profesional (notas, medidas, fotos y voz) y no sale en el PDF. Igual que en la web.
const PERFORACIONES = Array.from({ length: 48 }, (_, i) => i);
export function Nota({ titulo, children }: { titulo: string; children: ReactNode }) {
  const t = useTema();
  return (
    <View style={[e.nota, { backgroundColor: t.notaFondo, borderColor: t.notaBorde }]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={e.perforado}>
        {PERFORACIONES.map((i) => (
          <View key={i} style={[e.agujero, { backgroundColor: t.fondo, borderColor: t.notaBorde }]} />
        ))}
      </View>
      <View style={e.cabeceraNota}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {titulo}
        </Texto>
        <View style={e.sello}>
          <Icono nombre="candado" tamano={13} color={t.notaSello} />
          <Text style={[e.textoSello, { color: t.notaSello }]}>Solo para ti · no sale en el PDF</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const e = StyleSheet.create({
  boton: { minHeight: MIN_TOQUE, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s },
  primario: { minHeight: 52 },
  texto: { paddingHorizontal: espacio.m },
  textoBoton: { fontSize: letra.cuerpo, fontWeight: '600' },
  campo: { gap: espacio.xs + 2 },
  barraTeclado: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: espacio.l },
  agarreTeclado: { position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -20, top: 6, width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  listo: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  entrada: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: espacio.l, fontSize: letra.cuerpo }, // 16 pt: iOS no hace zoom al enfocar
  entradaActiva: { borderWidth: 2, paddingHorizontal: espacio.l - 1 }, // el borde crece sin mover el texto
  multilinea: { minHeight: 96, paddingTop: espacio.m, textAlignVertical: 'top' },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  tarjeta: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', padding: espacio.l, gap: espacio.m },
  sombra: { boxShadow: '0 1px 2px rgba(24, 27, 32, 0.05), 0 4px 16px rgba(24, 27, 32, 0.05)' },
  seccion: { gap: espacio.m },
  cabeceraSeccion: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: espacio.m },
  tituloSeccion: { flex: 1, gap: 2 },
  nota: { borderWidth: 1, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: radio.l, borderBottomRightRadius: radio.l, borderCurve: 'continuous', paddingHorizontal: espacio.l, paddingTop: espacio.xl, paddingBottom: espacio.l, gap: espacio.l, overflow: 'hidden' },
  // Medios círculos del color de la página cortando el borde de arriba: la hoja se arrancó del talonario.
  perforado: { position: 'absolute', top: -5, left: 4, right: 0, flexDirection: 'row', gap: 6, overflow: 'hidden' },
  agujero: { width: 9, height: 9, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  cabeceraNota: { gap: espacio.xs },
  sello: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  textoSello: { fontSize: letra.chico, fontWeight: '600' },
});
