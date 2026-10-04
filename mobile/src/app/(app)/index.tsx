import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, mensajeDe } from '@/api/client';
import type { ResumenPresupuesto } from '@/api/types';
import { Boton, Pastilla, Texto } from '@/components/ui';
import { diaCorto } from '@/lib/fechas';
import { clp } from '@/lib/formato';
import { Sincronizacion } from '@/components/sincronizacion';
import { creacionesPendientes, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Estado que se muestra: el comercial manda una vez que el presupuesto salió; antes, el documental.
function estadoVisible(q: ResumenPresupuesto): { texto: string; tono: 'aviso' | 'ok' | 'suave' } {
  if (q.doc_status !== 'FINALIZED') return { texto: 'Pendiente', tono: 'aviso' };
  const comercial = { NONE: 'Cerrado', SENT: 'Enviado', FOLLOW_UP: 'Seguimiento', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado' } as const;
  return { texto: comercial[q.commercial_status], tono: q.commercial_status === 'ACCEPTED' ? 'ok' : 'suave' };
}

function Fila({ q }: { q: ResumenPresupuesto }) {
  const t = useTema();
  const estado = estadoVisible(q);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${q.customer.name}, ${estado.texto}`}
      onPress={() => router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } })}
      style={({ pressed }) => [e.fila, { backgroundColor: t.tarjeta, borderColor: t.borde, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={e.filaTexto}>
        <Texto fuerte numberOfLines={1}>{q.customer.name}</Texto>
        <Texto variante="chico" suave numberOfLines={2}>{q.service_description || 'Sin descripción todavía'}</Texto>
        <Pastilla texto={estado.texto} tono={estado.tono} />
        {q.next_contact_date ? <Texto variante="chico" suave>Contactar el {diaCorto(q.next_contact_date)}</Texto> : null}
      </View>
      <Texto fuerte style={e.monto}>{q.total > 0 ? clp(q.total) : '—'}</Texto>
    </Pressable>
  );
}

export default function Presupuestos() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [lista, setLista] = useState<ResumenPresupuesto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const { pendientes } = useCola();
  const colaVacia = pendientes === 0;

  const cargar = useCallback(async () => {
    let base: ResumenPresupuesto[] | null = null;
    try {
      base = (await api<{ data: ResumenPresupuesto[] }>('/quotes?limit=100')).data;
      void guardarKv('lista', JSON.stringify(base));
      setError(null);
    } catch (err) {
      setError(mensajeDe(err)); // sin señal en terreno se muestra la última lista guardada
      base = JSON.parse((await leerKv('lista')) ?? 'null') as ResumenPresupuesto[] | null;
    }
    // Los presupuestos creados sin conexión aparecen arriba hasta que el servidor los reciba.
    const nuevos: ResumenPresupuesto[] = [];
    for (const id of await creacionesPendientes()) {
      const b = await leerBorrador(id);
      if (b && !base?.some((r) => r.id === id)) nuevos.push({ id, number: null, customer: { id: b.customer.id, name: b.customer.name }, service_description: b.service_description, total: 0, doc_status: 'DRAFT', commercial_status: 'NONE', next_contact_date: null, updated_at: '' });
    }
    setLista(base || nuevos.length ? [...nuevos, ...(base ?? [])] : base);
  }, []);

  useFocusEffect(useCallback(() => void cargar(), [cargar])); // al volver de crear o abrir uno, se actualiza
  useEffect(() => void vaciar().then(cargar), [cargar, colaVacia]); // y al terminar de sincronizar

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <FlashList
        data={lista ?? []}
        keyExtractor={(q) => q.id}
        renderItem={({ item }) => <Fila q={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: espacio.l, paddingBottom: insets.bottom + MIN_TOQUE + espacio.xxl }}
        ItemSeparatorComponent={Separador}
        refreshing={refrescando}
        onRefresh={async () => {
          setRefrescando(true);
          await cargar();
          setRefrescando(false);
        }}
        ListHeaderComponent={
          <View style={e.aviso}>
            <Sincronizacion />
            {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
          </View>
        }
        ListEmptyComponent={
          lista === null ? (
            <ActivityIndicator style={e.cargando} color={t.suave} />
          ) : (
            <View style={e.vacio}>
              <Texto variante="subtitulo">Aún no tienes presupuestos</Texto>
              <Texto suave>Cuando estés en una visita, toca «Nuevo presupuesto»: anota al cliente y el trabajo, y después sigue con fotos, medidas e ítems.</Texto>
            </View>
          )
        }
      />
      {/* Acción principal en la zona del pulgar (tercio inferior) */}
      <View pointerEvents="box-none" style={[e.cta, { paddingBottom: insets.bottom + espacio.m }]}>
        <Boton titulo="+ Nuevo presupuesto" onPress={() => router.push('/nuevo')} style={e.ctaBoton} />
      </View>
    </View>
  );
}

const Separador = () => <View style={{ height: espacio.m }} />;

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: espacio.l, minHeight: MIN_TOQUE },
  filaTexto: { flex: 1, gap: espacio.xs },
  monto: { fontVariant: ['tabular-nums'] },
  aviso: { gap: espacio.s, paddingBottom: espacio.m },
  cargando: { marginTop: espacio.xxl },
  vacio: { gap: espacio.s, paddingTop: espacio.xxl },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: espacio.l },
  ctaBoton: { boxShadow: '0 6px 20px rgba(29, 78, 216, 0.35)' },
});
