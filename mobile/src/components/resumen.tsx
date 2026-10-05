import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { api } from '@/api/client';
import type { Indicadores, Tablero } from '@/api/types';
import { Presionable, Seccion, Tarjeta, Texto } from '@/components/ui';
import { clp } from '@/lib/formato';
import { useRefrescar } from '@/lib/refrescar';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, radio, useTema } from '@/theme';

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
export function Resumen() {
  const t = useTema();
  const [d, setD] = useState<Datos | null>(null);
  const cargar = useCallback(async () => {
    try {
      const [tablero, ...meses] = await Promise.all([api<Tablero>('/dashboard'), ...ultimosMeses().map((m) => api<Indicadores>(`/dashboard/kpis?month=${m}`))]);
      const datos = { kpis: meses[5]!, tablero, meses };
      setD(datos);
      void guardarKv('resumen', JSON.stringify(datos));
    } catch {
      const guardado = JSON.parse((await leerKv('resumen')) ?? 'null') as Datos | null;
      if (guardado && !guardado.meses) return; // guardado por una versión anterior
      setD((actual) => actual ?? guardado); // sin conexión: lo último que se vio
    }
  }, []);
  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de abrir o crear uno
  useRefrescar(() => void cargar(), 30000);
  if (!d) return null;
  const { kpis: k, tablero } = d;
  const hoy = tablero.follow_up;
  const tasa = k.acceptance_rate === null ? '—' : `${Math.round(k.acceptance_rate * 100)} %`;

  return (
    // Los datos llegan después de abrir: aparecen con un fundido corto (solo opacidad, así que sirve también con «reducir movimiento»).
    <Animated.View entering={FadeIn.duration(200)} style={e.bloque}>
      <Seccion titulo="Este mes">
        <View style={e.grilla}>
          <Dato indice={0} titulo="Presupuestado" valor={clp(k.quoted_amount)} nota={`${k.quotes_count} ${k.quotes_count === 1 ? 'presupuesto' : 'presupuestos'}`} fuerte />
          <Dato indice={1} titulo="Aceptado" valor={clp(k.accepted_amount)} nota={`${k.accepted_count} ${k.accepted_count === 1 ? 'aceptado' : 'aceptados'}`} />
          <Dato indice={2} titulo="Aceptación" valor={tasa} nota="de los que se resolvieron" />
          <Dato indice={3} titulo="Ticket promedio" valor={k.accepted_count ? clp(k.avg_ticket) : '—'} nota="por presupuesto aceptado" />
        </View>
      </Seccion>

      <Seccion titulo="Últimos 6 meses" descripcion="Lo presupuestado y lo aceptado, mes a mes.">
        <Grafico meses={d.meses} />
      </Seccion>

      <Seccion titulo="Clientes por contactar" descripcion={hoy.length ? `${tablero.counts.follow_up} ${tablero.counts.follow_up === 1 ? 'espera' : 'esperan'} tu llamada hoy o ya pasó la fecha.` : undefined}>
        {hoy.length ? (
          <Tarjeta style={e.lista}>
            <View style={[e.fila, e.encabezado, { backgroundColor: t.campo, borderBottomColor: t.borde }]}>
              <Texto variante="chico" suave fuerte style={e.flex}>Cliente</Texto>
              <Texto variante="chico" suave fuerte style={e.colEnviado}>Enviado</Texto>
              <Texto variante="chico" suave fuerte style={e.colMonto}>Monto</Texto>
            </View>
            {hoy.map((q) => (
              <Presionable
                key={q.id}
                accessibilityRole="button"
                accessibilityLabel={`${q.customer.name}, enviado hace ${q.days_since_sent} días, ${clp(q.total)}. Abrir`}
                onPress={() => router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } })}
                estilo={[e.fila, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }]}
              >
                <Texto fuerte numberOfLines={2} style={e.flex}>{q.customer.name}</Texto>
                <Texto suave style={e.colEnviado}>{q.days_since_sent === 0 ? 'hoy' : `hace ${q.days_since_sent} d`}</Texto>
                <Texto numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[e.colMonto, e.numero]}>{clp(q.total)}</Texto>
              </Presionable>
            ))}
          </Tarjeta>
        ) : (
          <Tarjeta>
            <Texto suave>Nadie por contactar hoy. Los presupuestos enviados con fecha de contacto aparecen aquí cuando les toca.</Texto>
          </Tarjeta>
        )}
      </Seccion>
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

// Barras de lo presupuestado (azul) y lo aceptado (naranja) por mes, hechas con Views: seis meses no justifican una librería de gráficos.
function Grafico({ meses }: { meses: Indicadores[] }) {
  const t = useTema();
  const max = Math.max(1, ...meses.flatMap((m) => [m.quoted_amount, m.accepted_amount]));
  const ALTO = 120;
  return (
    <Tarjeta>
      <View style={e.barras} accessibilityLabel={`Presupuestado y aceptado por mes. ${meses.map((m) => `${NOMBRES[Number(m.month.slice(5)) - 1]}: ${clp(m.quoted_amount)} presupuestado, ${clp(m.accepted_amount)} aceptado`).join('. ')}`}>
        {meses.map((m, i) => (
          <View key={m.month} style={e.mes}>
            <View style={[e.par, { height: ALTO }]}>
              <Barra alto={Math.max(3, (m.quoted_amount / max) * ALTO)} color={t.acento} orden={i * 2} />
              <Barra alto={Math.max(3, (m.accepted_amount / max) * ALTO)} color={t.naranja} orden={i * 2 + 1} />
            </View>
            <Texto variante="chico" suave>{NOMBRES[Number(m.month.slice(5)) - 1]}</Texto>
          </View>
        ))}
      </View>
      <View style={e.leyenda}>
        <View style={e.item}><View style={[e.punto, { backgroundColor: t.acento }]} /><Texto variante="chico" suave>Presupuestado</Texto></View>
        <View style={e.item}><View style={[e.punto, { backgroundColor: t.naranja }]} /><Texto variante="chico" suave>Aceptado</Texto></View>
      </View>
    </Tarjeta>
  );
}

function Dato({ indice, titulo, valor, nota, fuerte }: { indice: number; titulo: string; valor: string; nota: string; fuerte?: boolean }) {
  const t = useTema();
  // El número principal del mes va con el azul de la marca; el resto, en tarjetas neutras.
  return (
    // Las cuatro tarjetas entran una tras otra (60 ms de diferencia) subiendo un poco.
    <Animated.View entering={FadeInDown.delay(indice * 60).duration(280).easing(EASE_OUT).reduceMotion(ReduceMotion.System)} style={[e.dato, { backgroundColor: fuerte ? t.acento : t.tarjeta, borderColor: fuerte ? t.acento : t.borde }]}>
      <Texto variante="chico" color={fuerte ? 'sobreAcento' : undefined} suave={!fuerte}>{titulo}</Texto>
      <Texto variante="titulo" color={fuerte ? 'sobreAcento' : undefined} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={e.numero}>{valor}</Texto>
      <Texto variante="chico" color={fuerte ? 'sobreAcento' : undefined} suave={!fuerte} numberOfLines={1}>{nota}</Texto>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  bloque: { gap: espacio.l, paddingBottom: espacio.l },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
  dato: { flexGrow: 1, flexBasis: '45%', borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.l, borderCurve: 'continuous', padding: espacio.l, gap: 2 },
  numero: { fontVariant: ['tabular-nums'] },
  lista: { padding: 0, gap: 0, overflow: 'hidden' },
  fila: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.m, paddingHorizontal: espacio.l },
  flex: { flex: 1 },
  encabezado: { minHeight: 36, paddingVertical: espacio.s, borderBottomWidth: StyleSheet.hairlineWidth },
  colEnviado: { width: 76 },
  colMonto: { width: 96, textAlign: 'right' },
  barras: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mes: { alignItems: 'center', gap: espacio.xs, flex: 1 },
  par: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barra: { width: 12, borderRadius: 3 },
  leyenda: { flexDirection: 'row', gap: espacio.l, paddingTop: espacio.m },
  item: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
