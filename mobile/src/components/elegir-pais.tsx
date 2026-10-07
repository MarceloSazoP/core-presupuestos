import { Fragment } from 'react';
import { StyleSheet, Text as TextoNativo } from 'react-native';
import { Divider, List } from 'react-native-paper';
import { HojaM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { bandera, PAISES_ORDENADOS, type Pais } from '@/lib/paises';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Hoja para elegir un país (en iPhone, la hoja nativa que se desliza desde abajo; en Android, a pantalla completa). Sirve para el país
// de la cuenta (moneda e impuesto) y para el código de país de un teléfono: `titulo`, `nota` y `detalle` dicen qué se muestra en cada
// caso. Con Material 3: la barra de la hoja y una lista en una tarjeta; el elegido, en el tono suave del acento y con su ✓.
export function ElegirPais({ titulo, nota, detalle, actual, alElegir, alCerrar }: { titulo: string; nota?: string; detalle: (p: Pais) => string; actual: string; alElegir: (country: string) => void; alCerrar: () => void }) {
  const t = useTema();
  return (
    <HojaM titulo={titulo} listo={{ titulo: 'Cerrar', fuerte: true, onPress: alCerrar }} alCerrar={alCerrar}>
      {nota ? <TextoM variante="chico" suave>{nota}</TextoM> : null}
      <TarjetaM sinRelleno>
        {PAISES_ORDENADOS.map((p, n) => {
          const elegido = p.country === actual;
          return (
            <Fragment key={p.country}>
              {n > 0 ? <Divider /> : null}
              <List.Item
                title={p.name}
                description={detalle(p)}
                onPress={() => alElegir(p.country)}
                accessibilityRole="radio"
                accessibilityState={{ selected: elegido }}
                accessibilityLabel={`${p.name}, ${detalle(p)}`}
                style={[e.fila, elegido ? { backgroundColor: `${t.acento}1F` } : null]}
                titleStyle={[e.titulo, { color: t.texto }, elegido ? e.fuerte : null]}
                descriptionStyle={{ color: t.suave }}
                left={() => <TextoNativo style={e.bandera} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{bandera(p.country)}</TextoNativo>}
                right={() => (elegido ? <Icono nombre="listo" tamano={20} color={t.acento} /> : null)}
              />
            </Fragment>
          );
        })}
      </TarjetaM>
    </HojaM>
  );
}

const e = StyleSheet.create({
  fila: { minHeight: MIN_TOQUE + 8, justifyContent: 'center', paddingLeft: espacio.l, paddingRight: espacio.l },
  titulo: { fontSize: 16 },
  fuerte: { fontWeight: '600' },
  bandera: { fontSize: 24, alignSelf: 'center' },
});
