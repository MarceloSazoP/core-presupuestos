import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { Icono, type NombreIcono } from '@/components/ui';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Piezas de Material 3 (React Native Paper) con los colores y medidas de la app, para las pantallas que ya pasaron a Material (Inicio y
// Configurar). Las demás siguen con `Seccion`, `Tarjeta` y `Boton` de ui.tsx.

// Título de sección: el ícono en un círculo tonal, el nombre en «título medio» y, si hace falta, la línea que explica para qué sirve.
export function SeccionM({ titulo, icono, descripcion, children }: { titulo: string; icono: NombreIcono; descripcion?: string; children: ReactNode }) {
  const t = useTema();
  return (
    <View style={e.seccion}>
      <View style={e.cabecera}>
        <View style={[e.iconoSeccion, { backgroundColor: `${t.acento}1F` }]}><Icono nombre={icono} tamano={18} color={t.acento} /></View>
        <View style={e.flex}>
          <Text variant="titleMedium" accessibilityRole="header">{titulo}</Text>
          {descripcion ? <Text variant="bodySmall" style={{ color: t.suave }}>{descripcion}</Text> : null}
        </View>
      </View>
      {children}
    </View>
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

type VarianteM = 'principal' | 'contorno' | 'texto' | 'peligro';

// Botón de Material: «principal» relleno con el acento; «contorno» con el texto en el color de texto y el ícono en su color (como los
// secundarios de la app); «texto» sin borde; «peligro» relleno rojo. Siempre de 48 de alto como mínimo.
export function BotonM({ titulo, variante = 'principal', icono, colorIcono, cargando, disabled, onPress, style, accessibilityLabel }: {
  titulo: string;
  variante?: VarianteM;
  icono?: NombreIcono;
  colorIcono?: string;
  cargando?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTema();
  const modo = variante === 'principal' || variante === 'peligro' ? 'contained' : variante === 'contorno' ? 'outlined' : 'text';
  const texto = variante === 'principal' ? t.sobreAcento : variante === 'peligro' ? '#FFFFFF' : variante === 'contorno' ? t.texto : t.acento;
  return (
    <Button
      mode={modo}
      onPress={onPress}
      loading={cargando}
      disabled={disabled || cargando}
      buttonColor={variante === 'peligro' ? t.error : undefined}
      textColor={texto}
      icon={icono && !cargando ? ({ size, color }) => <Icono nombre={icono} tamano={size} color={colorIcono ?? color} /> : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[e.boton, variante === 'contorno' && { borderColor: t.bordeCampo }, style]}
      contentStyle={e.contenidoBoton}
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
  textoBoton: { fontSize: 16, lineHeight: 22 },
});
