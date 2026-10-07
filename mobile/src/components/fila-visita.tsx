import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, Text, TouchableRipple } from 'react-native-paper';
import { TarjetaM } from '@/components/material';
import { Icono, type NombreIcono } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Piezas de la pantalla Visita (rediseño): grupos con su título y, a la derecha, a quién llega lo que tienen («Sale en el PDF», «No sale
// en el PDF»), y filas de lista de Material 3 que solo muestran lo que hay. Tocar una fila abre su hoja para editar. Sin campos con borde,
// ni botones «Agregar…», ni textos de ayuda a la vista: eso era el ruido.

// Un grupo: el título (con candado si es solo del profesional), su nota a la derecha y una tarjeta con las filas, separadas por una línea
// que empieza donde empieza el texto.
export function GrupoVisita({ titulo, nota, candado, children }: { titulo: string; nota: string; candado?: boolean; children: ReactNode }) {
  const t = useTema();
  const filas = Children.toArray(children);
  return (
    <View style={e.grupo}>
      <View style={e.cabecera}>
        <View style={e.titulo}>
          {candado ? <Icono nombre="candado" tamano={14} color={t.suave} /> : null}
          <Text variant="titleSmall" accessibilityRole="header" style={e.textoTitulo}>{titulo}</Text>
        </View>
        <Text variant="bodySmall" style={{ color: t.suave }}>{nota}</Text>
      </View>
      <TarjetaM sinRelleno>
        {filas.map((fila, i) => (
          <Fragment key={i}>
            {i > 0 ? <Divider style={e.linea} /> : null}
            {fila}
          </Fragment>
        ))}
      </TarjetaM>
    </View>
  );
}

// Una fila: el ícono en gris, la etiqueta chica arriba y lo que hay debajo (hasta dos líneas). Si no hay nada, `vacio` es lo que se invita
// a hacer, en el acento, con una `insignia` (p. ej. «Obligatorio para terminar») o una `ayuda` en gris. `children` va bajo el valor (las
// miniaturas de las fotos); `derecha` reemplaza la flecha (el mapa de la dirección).
export function FilaVisita({ icono, etiqueta, valor, vacio, insignia, ayuda, derecha, children, alTocar, accessibilityLabel }: {
  icono: NombreIcono;
  etiqueta: string;
  valor?: string | null;
  vacio?: string;
  insignia?: string;
  ayuda?: string;
  derecha?: ReactNode;
  children?: ReactNode;
  alTocar: () => void;
  accessibilityLabel?: string;
}) {
  const t = useTema();
  const lleno = !!valor?.trim();
  return (
    <TouchableRipple accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${etiqueta}: ${lleno ? valor : vacio ?? 'vacío'}. Editar`} onPress={alTocar} style={e.fila}>
      <View style={e.contenido}>
        <View style={e.icono}>
          <Icono nombre={icono} tamano={22} color={t.suave} />
        </View>
        <View style={e.textos}>
          <Text variant="labelMedium" style={{ color: t.suave }}>{etiqueta}</Text>
          {lleno ? (
            <Text variant="bodyLarge" numberOfLines={2} style={{ color: t.texto }}>{valor}</Text>
          ) : vacio ? (
            <View style={e.vacio}>
              <Text variant="bodyLarge" style={[e.invitacion, { color: t.acento }]}>{vacio}</Text>
              {insignia ? (
                <View style={[e.insignia, { backgroundColor: `${t.aviso}1F` }]}>
                  <Text variant="labelSmall" style={{ color: t.aviso }}>{insignia}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {!lleno && ayuda ? <Text variant="bodySmall" style={{ color: t.suave }}>{ayuda}</Text> : null}
          {children}
        </View>
        {derecha ?? <Icono nombre="siguiente" tamano={18} color={t.suave} />}
      </View>
    </TouchableRipple>
  );
}

const ICONO = 22;
const e = StyleSheet.create({
  grupo: { gap: espacio.s },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m, paddingHorizontal: espacio.xs },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoTitulo: { fontSize: 15, fontWeight: '600' },
  fila: { paddingVertical: 14, paddingHorizontal: espacio.l },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  icono: { alignSelf: 'flex-start', paddingTop: 2 },
  textos: { flex: 1, gap: 2 },
  vacio: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espacio.s },
  invitacion: { fontWeight: '500' },
  insignia: { borderRadius: 10, paddingHorizontal: espacio.s, paddingVertical: 2 },
  // La línea empieza donde empieza el texto: el relleno de la fila más el ícono y su espacio.
  linea: { marginLeft: espacio.l + ICONO + espacio.l },
});
