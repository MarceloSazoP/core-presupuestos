import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { simboloUnidad } from '@/lib/unidades';
import { useCallback, useEffect, useRef, useState } from 'react';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Cierre, Envio } from '@/components/cierre';
import { ContactoCliente } from '@/components/contacto-cliente';
import { Seguimiento } from '@/components/seguimiento';
import { Levantamiento } from '@/components/levantamiento';
import { NuevaVersion } from '@/components/nueva-version';
import { PartesDeslizables } from '@/components/partes-deslizables';
import { Sincronizacion } from '@/components/sincronizacion';
import { TituloConIcono } from '@/components/titulo-con-icono';
import { Boton, Icono, Pastilla, Segmentos, Tarjeta, Texto } from '@/components/ui';
import { leerCodigo } from '@/lib/codigos';
import { dinero } from '@/lib/formato';
import { huellaCierre, huellaLevantamiento } from '@/lib/huellas';
import { useRefrescar } from '@/lib/refrescar';
import { guardarBorrador, hayPendientesDe, leerBorrador, useCola, vaciar } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Detalle del presupuesto. Lo central de este hito: el código que se escribe en la web para completar o cerrar el
// presupuesto desde el computador (CLAUDE.md §16). Se muestra con letras grandes y se copia o comparte con un toque.
export default function Detalle() {
  const t = useTema();
  const { id, nuevo } = useLocalSearchParams<{ id: string; nuevo?: string }>();
  const [q, setQ] = useState<Presupuesto | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parte, setParte] = useState<string | null>(null); // pestaña elegida; null = la primera de su estado
  const [vista, setVista] = useState({ cierre: 0, levantamiento: 0 }); // sube cuando el servidor trae cambios de otro lugar (la web)
  const actual = useRef<Presupuesto | null>(null);
  useEffect(() => {
    actual.current = q;
  }, [q]);

  const { pendientes } = useCola();
  const colaVacia = pendientes === 0;

  // La pantalla trabaja sobre la copia local (q); el servidor la reemplaza solo cuando no quedan cambios sin enviar.
  const recargar = useCallback(async () => {
    await vaciar();
    void leerCodigo(id).then(setCodigo); // el código llega al sincronizar un presupuesto creado sin conexión
    try {
      const servidor = await api<Presupuesto>(`/quotes/${id}`);
      if (!(await hayPendientesDe(id))) {
        const local = actual.current;
        if (local) setVista((v) => ({ cierre: v.cierre + Number(huellaCierre(local) !== huellaCierre(servidor)), levantamiento: v.levantamiento + Number(huellaLevantamiento(local) !== huellaLevantamiento(servidor)) }));
        setQ(servidor);
      }
    } catch (err) {
      setError(mensajeDe(err)); // sin conexión se sigue con la copia local, si la hay
    }
  }, [id]);

  useRefrescar(() => void recargar()); // cambios hechos en la web aparecen aquí sin salir de la pantalla

  const cambiar = useCallback((f: (p: Presupuesto) => Presupuesto) => setQ((p) => (p ? f(p) : p)), []);

  useEffect(() => {
    void leerBorrador(id).then((b) => b && setQ((actual) => actual ?? b));
    void vaciar().then(recargar);
  }, [id, recargar, colaVacia]); // al vaciarse la cola se trae la versión del servidor (con las fotos ya subidas)

  useEffect(() => {
    if (q) void guardarBorrador(q);
  }, [q]);

  // Al terminar el presupuesto desde esta pantalla, la tarjeta de envío entra con un asentado suave (no al abrir uno ya cerrado).
  const [recienTerminado, setRecienTerminado] = useState(false);

  if (!q) {
    return (
      <View style={[e.centro, { backgroundColor: t.fondo }]}>
        {error ? <Texto color="error" accessibilityRole="alert">{error}</Texto> : <ActivityIndicator color={t.suave} />}
      </View>
    );
  }

  const cerrado = q.doc_status === 'FINALIZED';

  // Qué pestañas tiene: uno pendiente se trabaja en dos partes; uno cerrado se envía, se le hace seguimiento y se revisa.
  const partes = cerrado
    ? [{ id: 'enviar', texto: 'Enviar' }, ...(q.commercial_status !== 'NONE' ? [{ id: 'seguimiento', texto: 'Seguimiento' }] : []), { id: 'detalle', texto: 'Detalle' }]
    : [{ id: 'visita', texto: 'Visita' }, { id: 'presupuesto', texto: 'Presupuesto' }];
  const actualId = partes.some((x) => x.id === parte) ? parte! : partes[0]!.id;
  // Las partes de un presupuesto pendiente se quedan montadas aunque no se vean: lo que se está escribiendo no se pierde al cambiar.
  const oculta = (id: string) => (actualId === id ? null : e.oculta);
  // Deslizar a los lados cambia de parte (el movimiento vive en PartesDeslizables).
  const posicion = partes.findIndex((x) => x.id === actualId);
  const ir = (paso: number) => {
    const destino = partes[posicion + paso];
    if (!destino) return;
    void Haptics.selectionAsync();
    setParte(destino.id);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Stack.Screen
        options={{
          title: codigo ?? q.code_id ?? 'Presupuesto',
          headerTitle: () => <TituloConIcono texto={codigo ?? q.code_id ?? 'Presupuesto'} icono={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} />,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Código y QR para abrirlo en la web" hitSlop={8} onPress={() => router.push({ pathname: '/codigo', params: { id, titulo: `${q.number ?? 'Presupuesto'} de ${q.customer.name}`, ...(q.code_id ? { codeId: q.code_id } : {}) } })} style={e.cabeceraBoton}>
              <Icono nombre="qr" tamano={22} color={t.acento} />
            </Pressable>
          ),
        }}
      />
      <Sincronizacion />

      {/* Cabecera: quién es el cliente y en qué va. Lo demás vive en las pestañas de abajo. */}
      <View style={e.bloque}>
        <View style={e.pastillas}>
          <Pastilla texto={cerrado ? `Cerrado · ${q.number}` : 'Pendiente'} tono={cerrado ? 'ok' : 'aviso'} />
          {(q.version ?? 1) > 1 ? <Pastilla texto={`Versión ${q.version}`} tono="acento" /> : null}
        </View>
        {q.previous_number ? <Texto variante="chico" suave>Reemplaza al presupuesto {q.previous_number}</Texto> : null}
        <ContactoCliente key={`${q.customer.name}|${q.customer.phone}|${q.customer.email}`} q={q} cambiar={cambiar} />
      </View>

      {nuevo === '1' ? (
        <View style={[e.exito, { backgroundColor: `${t.ok}1A`, borderColor: `${t.ok}66` }]}>
          <Icono nombre="listo" tamano={22} color={t.ok} />
          <View style={e.flex}>
            <Texto fuerte color="ok">Presupuesto creado</Texto>
            <Texto variante="chico" suave>Sigue con la visita y después arma el precio. El código para abrirlo en la web está arriba, en el ícono QR.</Texto>
          </View>
        </View>
      ) : null}

      <Segmentos opciones={partes} valor={actualId} alElegir={setParte} etiqueta="Partes del presupuesto" />

      <PartesDeslizables posicion={posicion} total={partes.length} alIr={ir}>
      {cerrado ? (
        <>
          <View style={[e.parte, oculta('enviar')]}>
            {q.commercial_status === 'REJECTED' ? <NuevaVersion q={q} /> : null}
            <Animated.View entering={recienTerminado ? FadeInDown.duration(300).easing(EASE_OUT) : undefined}>
              <Envio q={q} recargar={recargar} />
            </Animated.View>
          </View>
          {q.commercial_status !== 'NONE' ? (
            <View style={[e.parte, oculta('seguimiento')]}>
              <Seguimiento q={q} recargar={recargar} />
            </View>
          ) : null}
          <View style={[e.parte, oculta('detalle')]}>
            {q.service_description || q.address ? (
              <Tarjeta>
                {q.service_description ? <Texto>{q.service_description}</Texto> : null}
                {q.address ? <Texto variante="chico" suave>{q.address}</Texto> : null}
              </Tarjeta>
            ) : null}
            {q.items.length ? (
              <Tarjeta>
                <Texto variante="subtitulo" accessibilityRole="header">Ítems</Texto>
                {q.items.map((i) => (
                  <View key={i.id} style={[e.item, { borderBottomColor: t.borde }]}>
                    <View style={e.flex}>
                      <Texto>{i.description}</Texto>
                      {i.kind === 'TASK' ? (
                        <Texto variante="chico" suave>Tarea</Texto>
                      ) : (
                        <Texto variante="chico" suave style={e.monto}>{String(i.quantity).replace('.', ',')} {simboloUnidad(i.unit)} × {dinero(i.unit_price, q.currency)}</Texto>
                      )}
                    </View>
                    <Texto fuerte style={e.monto}>{i.kind === 'TASK' && i.line_total === 0 ? 'Incluido' : dinero(i.line_total, q.currency)}</Texto>
                  </View>
                ))}
                {q.include_vat ? (
                  <View style={e.filaTotal}>
                    <Texto suave>{q.vat_label ?? 'IVA'} ({q.vat_rate ?? 19}%)</Texto>
                    <Texto suave style={e.monto}>{dinero(q.vat, q.currency)}</Texto>
                  </View>
                ) : null}
                <View style={[e.filaTotal, e.total, { borderTopColor: t.texto }]}>
                  <Texto fuerte>Total</Texto>
                  <Texto variante="titulo" style={e.monto}>{dinero(q.total, q.currency)}</Texto>
                </View>
              </Tarjeta>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <View style={[e.parte, oculta('visita')]}>
            <Levantamiento key={`levantamiento-${vista.levantamiento}`} q={q} cambiar={cambiar} />
            <Boton titulo="Seguir con el presupuesto" onPress={() => setParte('presupuesto')} />
          </View>
          <View style={[e.parte, oculta('presupuesto')]}>
            <Cierre key={`cierre-${vista.cierre}`} q={q} recargar={recargar} alTerminar={() => setRecienTerminado(true)} />
          </View>
        </>
      )}
      </PartesDeslizables>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.l },
  bloque: { gap: espacio.s },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  flex: { flex: 1 },
  parte: { gap: espacio.xl },
  oculta: { display: 'none' },
  cabeceraBoton: { minWidth: MIN_TOQUE - 8, minHeight: MIN_TOQUE - 8, alignItems: 'center', justifyContent: 'center' },
  exito: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.l },
  item: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.m, paddingBottom: espacio.m, borderBottomWidth: StyleSheet.hairlineWidth },
  filaTotal: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
  total: { borderTopWidth: 2, paddingTop: espacio.m },
  monto: { fontVariant: ['tabular-nums'] },
});
