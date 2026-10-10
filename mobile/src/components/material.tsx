import type { ReactNode } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { Icono, TECLADO_ID, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema, type Color } from '@/theme';
import { bordeElevado } from '@/theme-paper';

// Piezas de Material 3 (React Native Paper) con los colores y medidas de la app, para las pantallas que ya pasaron a Material (Inicio,
// Configurar, la lista y el presupuesto). Aceptan las mismas propiedades que `Texto`, `Seccion`, `Tarjeta`, `Boton`, `Pastilla` y `Nota`
// de ui.tsx, que siguen usando las demás pantallas: cambiar de una a otra no toca la lógica.

// Texto con la escala tipográfica de Material 3. Las variantes de la app pasan a la de Material del mismo uso: «titulo» → titular (28),
// «subtitulo» → título grande (22), «cuerpo» → cuerpo grande (16) y «chico» → cuerpo medio (14).
const VARIANTE_MD3 = { titulo: 'headlineMedium', subtitulo: 'titleLarge', cuerpo: 'bodyLarge', chico: 'bodyMedium' } as const;
export function TextoM({ variante = 'cuerpo', suave, fuerte, color, style, children, ...props }: TextProps & { variante?: keyof typeof VARIANTE_MD3; suave?: boolean; fuerte?: boolean; color?: Color }) {
  const t = useTema();
  return (
    <Text variant={VARIANTE_MD3[variante]} {...props} style={[{ color: t[color ?? (suave ? 'suave' : 'texto')] }, fuerte ? e.fuerte : null, style]}>
      {children}
    </Text>
  );
}

// Título de sección: el ícono en un círculo tonal, el nombre en «título medio» y, si hace falta, la línea que explica para qué sirve.
// `accion`: algo a la derecha del título (un botón).
export function SeccionM({ titulo, icono, descripcion, accion, children, style }: { titulo: string; icono?: NombreIcono; descripcion?: string; accion?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  return (
    <View style={[e.seccion, style]}>
      <View style={e.cabecera}>
        {icono ? <View style={[e.iconoSeccion, { backgroundColor: `${t.acento}1F` }]}><Icono nombre={icono} tamano={18} color={t.acento} /></View> : null}
        <View style={e.flex}>
          <Text variant="titleMedium" accessibilityRole="header">{titulo}</Text>
          {descripcion ? <Text variant="bodySmall" style={{ color: t.suave }}>{descripcion}</Text> : null}
        </View>
        {accion}
      </View>
      {children}
    </View>
  );
}

// Etiqueta tonal de Material (como un chip de solo lectura): el punto y el texto en su color, sobre su tono suave.
export function PastillaM({ texto, tono }: { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'seguimiento' | 'error' | 'info' }) {
  const t = useTema();
  const color = t[tono];
  return (
    <View style={[e.pastilla, { backgroundColor: `${color}1F` }]}>
      <View style={[e.punto, { backgroundColor: color }]} />
      <Text variant="labelLarge" style={{ color }}>{texto}</Text>
    </View>
  );
}

// «De la visita» en Material: una tarjeta elevada como las demás (sin el fondo amarillo de antes, que hacía ruido), con el título de sección,
// su ícono en el círculo tonal del acento y la etiqueta gris «Solo para ti · no sale en el PDF», que marca lo que es solo del profesional.
export function NotaM({ titulo, icono, children }: { titulo: string; icono?: NombreIcono; children: ReactNode }) {
  const t = useTema();
  return (
    <Card mode="elevated" elevation={1} style={[e.tarjeta, bordeElevado(t)]} contentStyle={e.lista}>
      <View style={e.contenidoNota}>
        <View style={e.cabecera}>
          {icono ? <View style={[e.iconoSeccion, { backgroundColor: `${t.acento}1F` }]}><Icono nombre={icono} tamano={18} color={t.acento} /></View> : null}
          <Text variant="titleMedium" accessibilityRole="header" style={e.flex}>{titulo}</Text>
        </View>
        <View style={[e.sello, { backgroundColor: `${t.suave}1F` }]}>
          <Icono nombre="candado" tamano={13} color={t.suave} />
          <Text variant="labelMedium" style={{ color: t.suave }}>Solo para ti · no sale en el PDF</Text>
        </View>
        {children}
      </View>
    </Card>
  );
}

// Tarjeta elevada con el radio de la app. `sinRelleno`: para listas de filas que llegan hasta el borde. En oscuro, su tono y su borde
// fino la separan del fondo (ver `bordeElevado`).
// El contenido va en una sola View: `Card` de Paper le agrega `index` y `total` a cada hijo directo, y un Fragment (como los que arma
// `GrupoAjustes`) no acepta esas propiedades («Invalid prop `index` supplied to React.Fragment»).
export function TarjetaM({ children, sinRelleno, elevacion = 1, style }: { children: ReactNode; sinRelleno?: boolean; elevacion?: 1 | 2; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  return (
    <Card mode="elevated" elevation={elevacion} style={[e.tarjeta, bordeElevado(t), style]} contentStyle={e.lista}>
      <View style={sinRelleno ? null : e.relleno}>{children}</View>
    </Card>
  );
}

// «primario» y «secundario» son los nombres de `Boton` en ui.tsx (equivalen a «principal» y «contorno»).
type VarianteM = 'principal' | 'contorno' | 'texto' | 'peligro' | 'primario' | 'secundario';

// Botón de Material 3, con su forma de píldora y su etiqueta: «principal» relleno con el acento (52 de alto); «contorno» (los secundarios)
// es el botón tonal de Material, relleno con el tono suave del acento, el texto en el color de texto y el ícono en su color; «texto» sin
// relleno; «peligro» relleno rojo. Mínimo 48 de alto.
// `prefijo`: un texto antes del ícono (un signo); `icono2`: un segundo ícono junto al primero. `alFinal`: el ícono va después del texto
// (una flecha que dice «sigue»).
export function BotonM({ titulo, variante = 'principal', icono, icono2, prefijo, colorIcono, alFinal, cargando, disabled, onPress, style, accessibilityLabel }: {
  titulo: string;
  variante?: VarianteM;
  icono?: NombreIcono;
  icono2?: NombreIcono;
  prefijo?: string;
  colorIcono?: string;
  alFinal?: boolean;
  cargando?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTema();
  const v = variante === 'primario' ? 'principal' : variante === 'secundario' ? 'contorno' : variante;
  const modo = v === 'principal' || v === 'peligro' ? 'contained' : v === 'contorno' ? 'contained-tonal' : 'text';
  const texto = v === 'principal' ? t.sobreAcento : v === 'peligro' ? '#FFFFFF' : v === 'contorno' ? t.texto : t.acento;
  const conIcono = !cargando && (icono || prefijo);
  return (
    <Button
      mode={modo}
      onPress={onPress}
      loading={cargando}
      disabled={disabled || cargando}
      buttonColor={v === 'peligro' ? t.error : undefined}
      textColor={texto}
      icon={
        conIcono
          ? ({ size, color }) => (
              <View style={e.iconos}>
                {prefijo ? <Text variant="labelLarge" style={[e.prefijo, { color: colorIcono ?? color }]}>{prefijo}</Text> : null}
                {icono ? <Icono nombre={icono} tamano={size} color={colorIcono ?? color} /> : null}
                {icono2 ? <Icono nombre={icono2} tamano={size} color={colorIcono ?? color} /> : null}
              </View>
            )
          : undefined
      }
      accessibilityLabel={accessibilityLabel}
      style={[e.boton, style]}
      contentStyle={[v === 'principal' ? e.contenidoPrincipal : e.contenidoBoton, alFinal ? e.iconoAlFinal : null]}
      labelStyle={e.textoBoton}
    >
      {titulo}
    </Button>
  );
}

// Campo de texto de Material 3 con contorno: la etiqueta flota sobre el borde al escribir, y el error o la ayuda van debajo. Acepta lo
// mismo que `Campo` de ui.tsx. El fondo es el de la tarjeta elevada donde suele ir (la etiqueta corta el borde con ese color); `fondo`
// lo cambia si va sobre otra superficie. `izquierda`: algo en la misma fila, antes del campo (el selector de país del teléfono).
export function CampoM({ etiqueta, error, ayuda, izquierda, fondo, style, ...props }: Omit<TextInputProps, 'style' | 'selectionColor' | 'placeholderTextColor' | 'cursorColor' | 'selectionHandleColor'> & { etiqueta: string; error?: string | null; ayuda?: string; izquierda?: ReactNode; fondo?: string; style?: StyleProp<TextStyle> }) {
  const t = useTema();
  const { colors } = useTheme();
  return (
    <View style={e.campo}>
      <View style={izquierda ? e.filaCampo : undefined}>
        {izquierda}
        <TextInput
          mode="outlined"
          label={etiqueta}
          accessibilityLabel={etiqueta}
          inputAccessoryViewID={TECLADO_ID}
          placeholderTextColor={t.suave}
          selectionColor={t.acento}
          {...props}
          error={!!error}
          outlineColor={t.bordeCampo}
          activeOutlineColor={t.acento}
          textColor={t.texto}
          outlineStyle={e.bordeCampo}
          contentStyle={props.multiline ? e.multilinea : undefined}
          style={[{ backgroundColor: fondo ?? colors.elevation.level1 }, izquierda ? e.flex : null, style]}
        />
      </View>
      {error ? (
        <HelperText type="error" visible accessibilityRole="alert">{error}</HelperText>
      ) : ayuda ? (
        <HelperText type="info" visible style={{ color: t.suave }}>{ayuda}</HelperText>
      ) : null}
    </View>
  );
}

// Una acción de la barra de la hoja: botón de texto de Material. `fuerte`: la que confirma (Listo, Guardar).
type AccionHoja = { titulo: string; onPress: () => void; fuerte?: boolean; disabled?: boolean };

// Hoja de edición de Material (en iPhone se abre como hoja y se puede bajar; en Android ocupa la pantalla y «atrás» la cierra): la barra
// de arriba con «Cancelar» a la izquierda, el título y la acción que confirma a la derecha, como el diálogo de pantalla completa de
// Material; debajo, el contenido con su desplazamiento y el teclado.
export function HojaM({ titulo, cancelar, listo, alCerrar, children }: { titulo: string; cancelar?: AccionHoja; listo?: AccionHoja; alCerrar: () => void; children: ReactNode }) {
  const t = useTema();
  const accion = (a: AccionHoja) => (
    <Button mode="text" onPress={a.onPress} disabled={a.disabled} textColor={t.acento} accessibilityLabel={a.titulo} style={e.boton} contentStyle={e.contenidoBoton} labelStyle={[e.textoAccion, a.fuerte ? e.accionFuerte : null]}>
      {a.titulo}
    </Button>
  );
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.flex, { backgroundColor: t.fondo }]}>
        {/* En la hoja de iOS, la barrita avisa que se puede deslizar hacia abajo. */}
        {Platform.OS === 'ios' ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[e.agarre, { backgroundColor: t.suave }]} /> : null}
        <View style={e.barraHoja}>
          <View style={e.ladoHoja}>{cancelar ? accion(cancelar) : null}</View>
          <Text variant="titleLarge" accessibilityRole="header" numberOfLines={1} style={e.tituloHoja}>{titulo}</Text>
          <View style={[e.ladoHoja, e.derechaHoja]}>{listo ? accion(listo) : null}</View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={e.contenidoHoja}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  seccion: { gap: espacio.m },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  iconoSeccion: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  tarjeta: { borderRadius: radio.l },
  relleno: { padding: espacio.l, gap: espacio.m },
  lista: { borderRadius: radio.l, overflow: 'hidden' },
  boton: { borderRadius: 999 },
  contenidoBoton: { minHeight: MIN_TOQUE },
  contenidoPrincipal: { minHeight: 52 },
  iconoAlFinal: { flexDirection: 'row-reverse' },
  // La etiqueta de Material 3 (labelLarge), un punto más grande para leer bien en terreno.
  textoBoton: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  iconos: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  prefijo: { fontSize: 16, fontWeight: '700' },
  fuerte: { fontWeight: '600' },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 28, borderRadius: 14, paddingHorizontal: 12 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  contenidoNota: { padding: espacio.l, gap: espacio.l },
  sello: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  campo: { gap: 0 },
  // El selector va a la altura del borde del campo (Paper lo dibuja 6 más abajo, donde flota la etiqueta).
  filaCampo: { flexDirection: 'row', alignItems: 'stretch', gap: espacio.s },
  bordeCampo: { borderRadius: radio.s },
  multilinea: { minHeight: 140, paddingTop: espacio.l },
  agarre: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, opacity: 0.5, marginTop: espacio.s },
  barraHoja: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.s, paddingTop: espacio.xs },
  ladoHoja: { minWidth: 96, alignItems: 'flex-start' },
  derechaHoja: { alignItems: 'flex-end' },
  tituloHoja: { flexShrink: 1, textAlign: 'center' },
  textoAccion: { fontSize: 16, lineHeight: 20, marginHorizontal: 12 },
  accionFuerte: { fontWeight: '700' },
  contenidoHoja: { padding: espacio.l, paddingBottom: espacio.xxl, gap: espacio.xl },
});
