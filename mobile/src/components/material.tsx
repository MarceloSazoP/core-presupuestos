import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { Icono, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema, type Color } from '@/theme';

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
export function PastillaM({ texto, tono }: { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'acento' | 'seguimiento' | 'error' }) {
  const t = useTema();
  const color = t[tono];
  return (
    <View style={[e.pastilla, { backgroundColor: `${color}1F` }]}>
      <View style={[e.punto, { backgroundColor: color }]} />
      <Text variant="labelLarge" style={{ color }}>{texto}</Text>
    </View>
  );
}

// «De la visita» en Material: una superficie tonal con el amarillo del talonario (lo que es solo del profesional y no sale en el PDF),
// el título de sección en el tono del sello y la etiqueta «Solo para ti».
export function NotaM({ titulo, icono, children }: { titulo: string; icono?: NombreIcono; children: ReactNode }) {
  const t = useTema();
  return (
    <Card mode="contained" style={[e.nota, { backgroundColor: t.notaFondo, borderColor: t.notaBorde }]} contentStyle={e.lista}>
      <View style={e.contenidoNota}>
        <View style={e.cabecera}>
          {icono ? <View style={[e.iconoSeccion, { backgroundColor: `${t.notaSello}1F` }]}><Icono nombre={icono} tamano={18} color={t.notaSello} /></View> : null}
          <Text variant="titleMedium" accessibilityRole="header" style={[e.flex, { color: t.notaSello }]}>{titulo}</Text>
        </View>
        <View style={[e.sello, { backgroundColor: `${t.notaSello}1A` }]}>
          <Icono nombre="candado" tamano={13} color={t.notaSello} />
          <Text variant="labelMedium" style={{ color: t.notaSello }}>Solo para ti · no sale en el PDF</Text>
        </View>
        {children}
      </View>
    </Card>
  );
}

// Tarjeta elevada con el radio de la app. `sinRelleno`: para listas de filas que llegan hasta el borde.
// El contenido va en una sola View: `Card` de Paper le agrega `index` y `total` a cada hijo directo, y un Fragment (como los que arma
// `GrupoAjustes`) no acepta esas propiedades («Invalid prop `index` supplied to React.Fragment»).
export function TarjetaM({ children, sinRelleno, elevacion = 1, style }: { children: ReactNode; sinRelleno?: boolean; elevacion?: 1 | 2; style?: StyleProp<ViewStyle> }) {
  return (
    <Card mode="elevated" elevation={elevacion} style={[e.tarjeta, style]} contentStyle={e.lista}>
      <View style={sinRelleno ? null : e.relleno}>{children}</View>
    </Card>
  );
}

// «primario» y «secundario» son los nombres de `Boton` en ui.tsx (equivalen a «principal» y «contorno»).
type VarianteM = 'principal' | 'contorno' | 'texto' | 'peligro' | 'primario' | 'secundario';

// Botón de Material: «principal» relleno con el acento (52 de alto, como el principal de la app); «contorno» con el texto en el color de
// texto y el ícono en su color (como los secundarios de la app); «texto» sin borde; «peligro» relleno rojo. Mínimo 48 de alto.
// `prefijo`: un texto antes del ícono (un signo); `icono2`: un segundo ícono junto al primero.
export function BotonM({ titulo, variante = 'principal', icono, icono2, prefijo, colorIcono, cargando, disabled, onPress, style, accessibilityLabel }: {
  titulo: string;
  variante?: VarianteM;
  icono?: NombreIcono;
  icono2?: NombreIcono;
  prefijo?: string;
  colorIcono?: string;
  cargando?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTema();
  const v = variante === 'primario' ? 'principal' : variante === 'secundario' ? 'contorno' : variante;
  const modo = v === 'principal' || v === 'peligro' ? 'contained' : v === 'contorno' ? 'outlined' : 'text';
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
      style={[e.boton, v === 'contorno' && { borderColor: t.bordeCampo }, style]}
      contentStyle={v === 'principal' ? e.contenidoPrincipal : e.contenidoBoton}
      labelStyle={e.textoBoton}
    >
      {titulo}
    </Button>
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
  boton: { borderRadius: radio.m },
  contenidoBoton: { minHeight: MIN_TOQUE },
  contenidoPrincipal: { minHeight: 52 },
  textoBoton: { fontSize: 16, lineHeight: 22 },
  iconos: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  prefijo: { fontSize: 16, fontWeight: '700' },
  fuerte: { fontWeight: '600' },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 28, borderRadius: 14, paddingHorizontal: 12 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  nota: { borderRadius: radio.l, borderWidth: StyleSheet.hairlineWidth },
  contenidoNota: { padding: espacio.l, gap: espacio.l },
  sello: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
