import { router, useFocusEffect } from 'expo-router';
import { INICIO, useDinero } from '@/lib/montos';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, DataTable, Text } from 'react-native-paper';
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { api } from '@/api/client';
import type { Indicadores, Tablero } from '@/api/types';
import { SeccionM } from '@/components/material';
import { Icono, type NombreIcono } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { porcentaje, puntos, variacion, type Variacion } from '@/lib/variacion';
import { useRefrescar } from '@/lib/refrescar';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, radio, useTema } from '@/theme';
import { bordeElevado } from '@/theme-paper';

type Datos = { kpis: Indicadores; tablero: Tablero; meses: Indicadores[] }; // meses: de más antiguo a este mes

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const NOMBRES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Los últimos seis meses como «YYYY-MM», terminando en el actual.
function ultimosMeses() {
  const hoy = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

// Resumen de arriba de la lista: cómo va el mes (cuatro números) y a quién hay que contactar hoy. Sin conexión muestra el último
// resumen guardado; si nunca hubo uno, no muestra nada (la lista de abajo sigue sirviendo).
// `ronda`: cada vez que cambia (al volver a Inicio) el bloque se vuelve a montar y sus animaciones se repiten; los datos no se pierden.
export function Resumen({ ronda = 0 }: { ronda?: number }) {
  const t = useTema();
  const moneda = usePais().currency; // los indicadores son del usuario: en la moneda de su país
  const montoDe = useDinero(INICIO);
  const clp = (n: number) => montoDe(n, moneda);
  const [d, setD] = useState<Datos | null>(null);
  const cargar = useCallback(async () => {
    try {
      const [tablero, ...meses] = await Promise.all([api<Tablero>('/dashboard'), ...ultimosMeses().map((m) => api<Indicadores>(`/dashboard/kpis?month=${m}`))]);
      const datos = { kpis: meses[5]!, tablero, meses };
      setD(datos);
      void guardarKv('resumen', JSON.stringify(datos));
    } catch {
      const guardado = JSON.parse((await leerKv('resumen')) ?? 'null') as Datos | null;
      if (guardado && (!guardado.meses || guardado.kpis.waiting_count === undefined)) return; // guardado por una versión anterior
      setD((actual) => actual ?? guardado); // sin conexión: lo último que se vio
    }
  }, []);
  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de abrir o crear uno
  useRefrescar(() => void cargar(), 30000);
  if (!d) return null;
  const { kpis: k, tablero } = d;
  const hoy = tablero.follow_up;
  const antes = d.meses[d.meses.length - 2]; // el mes anterior (los seis meses terminan en el actual)
  const tasa = k.acceptance_rate === null ? '—' : `${Math.round(k.acceptance_rate * 100)} %`;

  return (
    // Los datos llegan después de abrir: aparecen con un fundido corto (solo opacidad, así que sirve también con «reducir movimiento»).
    <Animated.View key={ronda} entering={FadeIn.duration(200)} style={e.bloque}>
      <View style={e.grilla}>
        <Dato indice={0} icono="reloj" titulo="Esperando respuesta" valor={clp(k.waiting_amount)} nota={`${k.waiting_count} ${k.waiting_count === 1 ? 'enviado' : 'enviados'}, sin respuesta`} tono="kpi1" />
        <Dato indice={1} icono="documento" tono="kpi2" titulo="Por terminar o enviar" valor={String(k.todo_count)} nota={k.todo_count === 1 ? 'presupuesto pendiente' : 'presupuestos pendientes'} />
        <Dato indice={2} icono="listo" tono="kpi3" variacion={antes && variacion(porcentaje(k.accepted_amount, antes.accepted_amount), '%')} titulo="Aceptado este mes" valor={clp(k.accepted_amount)} nota={`${k.accepted_count} ${k.accepted_count === 1 ? 'aceptado' : 'aceptados'}`} />
        <Dato indice={3} icono="tendencia" tono="kpi4" variacion={antes && variacion(puntos(k.acceptance_rate, antes.acceptance_rate), 'puntos')} titulo="Aceptación del mes" valor={tasa} nota="de los que respondió el cliente" />
      </View>

      <SeccionM titulo="Últimos 6 meses" icono="tendencia" descripcion="Lo presupuestado y lo aceptado, mes a mes.">
        <Grafico meses={d.meses} moneda={moneda} />
      </SeccionM>

      <SeccionM titulo="Clientes por contactar" icono="llamar" descripcion={hoy.length ? `${tablero.counts.follow_up} ${tablero.counts.follow_up === 1 ? 'espera' : 'esperan'} tu llamada hoy o ya pasó la fecha.` : undefined}>
        {hoy.length ? (
          <Card mode="elevated" elevation={2} style={[e.tarjeta, bordeElevado(t)]} contentStyle={e.lista}>
            <DataTable>
              <DataTable.Header style={{ borderBottomColor: t.borde }}>
                <DataTable.Title style={e.flex}>Cliente</DataTable.Title>
                <DataTable.Title style={e.colEnviado}>Enviado</DataTable.Title>
                <DataTable.Title numeric style={e.colMonto}>Monto</DataTable.Title>
              </DataTable.Header>
              {hoy.map((q, i) => (
                <DataTable.Row
                  key={q.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${q.customer.name}, enviado hace ${q.days_since_sent} días, ${montoDe(q.total, q.currency)}. Abrir`}
                  onPress={() => router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } })}
                  style={[e.fila, { borderBottomColor: t.borde }, i === hoy.length - 1 ? e.ultima : null]}
                >
                  <DataTable.Cell style={e.flex}>
                    <Text variant="bodyLarge" numberOfLines={2} style={e.nombre}>{q.customer.name}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell style={e.colEnviado}>
                    <Text variant="bodyMedium" style={{ color: t.suave }}>{q.days_since_sent === 0 ? 'hoy' : `hace ${q.days_since_sent} d`}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={e.colMonto}>
                    <Text variant="bodyLarge" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={e.numero}>{montoDe(q.total, q.currency)}</Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card>
        ) : (
          <Card mode="elevated" elevation={2} style={[e.tarjeta, bordeElevado(t)]} contentStyle={e.relleno}>
            <Text variant="bodyMedium" style={{ color: t.suave }}>Nadie por contactar hoy. Los presupuestos enviados con fecha de contacto aparecen aquí cuando les toca.</Text>
          </Card>
        )}
      </SeccionM>
    </Animated.View>
  );
}

// Una barra que crece desde la base al aparecer el gráfico (transform, no altura: corre en el hilo de la interfaz). Cada una espera 35 ms
// más que la anterior. Con «reducir movimiento» aparece ya completa.
function Barra({ alto, color, orden }: { alto: number; color: string; orden: number }) {
  const reducido = useReducedMotion();
  const progreso = useSharedValue(reducido ? 1 : 0);
  useEffect(() => {
    if (!reducido) progreso.set(withDelay(orden * 35, withTiming(1, { duration: 520, easing: EASE_OUT })));
  }, [orden, progreso, reducido]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.02 + progreso.get() * 0.98 }] }));
  return <Animated.View style={[e.barra, { height: alto, backgroundColor: color, transformOrigin: 'bottom' }, estilo]} />;
}

// Barras de lo presupuestado y lo aceptado por mes, hechas con Views: seis meses no justifican una librería de gráficos.
function Grafico({ meses, moneda }: { meses: Indicadores[]; moneda: string }) {
  const t = useTema();
  const montoDe = useDinero(INICIO);
  const clp = (n: number) => montoDe(n, moneda);
  const max = Math.max(1, ...meses.flatMap((m) => [m.quoted_amount, m.accepted_amount]));
  const ALTO = 64;
  return (
    <Card mode="elevated" elevation={2} style={[e.tarjeta, bordeElevado(t)]} contentStyle={e.relleno}>
      <View style={e.barras} accessibilityLabel={`Presupuestado y aceptado por mes. ${meses.map((m) => `${NOMBRES[Number(m.month.slice(5)) - 1]}: ${clp(m.quoted_amount)} presupuestado, ${clp(m.accepted_amount)} aceptado`).join('. ')}`}>
        {meses.map((m, i) => (
          <View key={m.month} style={e.mes}>
            <View style={[e.par, { height: ALTO }]}>
              <Barra alto={Math.max(3, (m.quoted_amount / max) * ALTO)} color={t.serie1} orden={i * 2} />
              <Barra alto={Math.max(3, (m.accepted_amount / max) * ALTO)} color={t.serie2} orden={i * 2 + 1} />
            </View>
            <Text variant="labelSmall" style={{ color: t.suave }}>{NOMBRES[Number(m.month.slice(5)) - 1]}</Text>
          </View>
        ))}
      </View>
      <View style={e.leyenda}>
        <View style={e.item}><View style={[e.punto, { backgroundColor: t.serie1 }]} /><Text variant="bodySmall" style={{ color: t.suave }}>Presupuestado</Text></View>
        <View style={e.item}><View style={[e.punto, { backgroundColor: t.serie2 }]} /><Text variant="bodySmall" style={{ color: t.suave }}>Aceptado</Text></View>
      </View>
    </Card>
  );
}

function Dato({ indice, icono, tono, titulo, valor, nota, variacion }: { indice: number; icono: NombreIcono; tono: 'kpi1' | 'kpi2' | 'kpi3' | 'kpi4'; titulo: string; valor: string; nota: string; variacion?: Variacion | null }) {
  const t = useTema();
  const tinta = t[`${tono}Tinta`];
  // Tarjeta tonal de Material 3: el fondo es el tono suave del indicador; el ícono va en un círculo del color de la superficie, y la cifra
  // en «titular», en el color de texto para que mande ella.
  return (
    // Las cuatro tarjetas entran una tras otra (60 ms de diferencia) subiendo un poco.
    <Animated.View accessible accessibilityLabel={`${titulo}: ${valor}. ${nota}.${variacion ? ` ${variacion.lectura}.` : ''}`} entering={FadeInDown.delay(indice * 60).duration(280).easing(EASE_OUT).reduceMotion(ReduceMotion.System)} style={e.dato}>
      <Card mode="contained" style={[e.tarjetaDato, { backgroundColor: t[`${tono}Fondo`] }]} contentStyle={e.contenidoDato}>
        <View style={e.cabeza}>
          <View style={[e.icono, { backgroundColor: t.tarjeta }]}><Icono nombre={icono} tamano={18} color={tinta} /></View>
          <Text variant="labelLarge" numberOfLines={2} style={[e.flex, { color: tinta }]}>{titulo}</Text>
        </View>
        <Text variant="headlineMedium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={e.numero}>{valor}</Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: tinta }}>{nota}</Text>
        {/* Frente al mes anterior: las flechas ▲▼ dicen si sube o baja. */}
        {variacion ? <Text variant="labelMedium" numberOfLines={1} style={{ color: tinta }}>{variacion.texto}</Text> : null}
      </Card>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  bloque: { gap: espacio.xl, paddingBottom: espacio.l },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
  dato: { flexGrow: 1, flexBasis: '45%' },
  tarjetaDato: { flex: 1, borderRadius: radio.l },
  contenidoDato: { padding: espacio.l, gap: espacio.xs },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  icono: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numero: { fontVariant: ['tabular-nums'] },
  tarjeta: { borderRadius: radio.l },
  relleno: { padding: espacio.l, gap: espacio.m },
  lista: { borderRadius: radio.l, overflow: 'hidden' },
  fila: { minHeight: 60, paddingHorizontal: espacio.l, borderBottomWidth: StyleSheet.hairlineWidth },
  ultima: { borderBottomWidth: 0 },
  nombre: { fontWeight: '500' },
  flex: { flex: 1 },
  // La separación de 12 entre columnas (la tabla de Paper no la trae): en la cabecera y en las filas.
  colEnviado: { width: 76, marginLeft: espacio.m },
  colMonto: { width: 96, marginLeft: espacio.m },
  barras: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mes: { alignItems: 'center', gap: espacio.xs, flex: 1 },
  par: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barra: { width: 12, borderRadius: 3 },
  leyenda: { flexDirection: 'row', gap: espacio.l, paddingTop: espacio.m },
  item: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
