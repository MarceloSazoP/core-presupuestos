import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Pressable as Toque } from 'react-native-gesture-handler';
import { Text, useTheme } from 'react-native-paper';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { ResumenPresupuesto } from '@/api/types';
import { useDialogo } from '@/components/dialogo';
import { Icono } from '@/components/ui';
import { hayDeslizadoReciente } from '@/lib/deslizado';
import { elegirEstado } from '@/lib/elegir-estado';
import { ESTADOS, estadosPosibles, type EstadoElegible } from '@/lib/estados';
import { diaCorto, enDias, haceCuanto } from '@/lib/fechas';
import { LISTA, useDinero, useMontosOcultos } from '@/lib/montos';
import { espacio, MIN_TOQUE, MONO, radio, useTema, type Tema } from '@/theme';

// Estado que se muestra: el comercial manda una vez que el presupuesto salió; antes, el documental.
function estadoVisible(q: ResumenPresupuesto): { texto: string; tono: 'aviso' | 'ok' | 'suave' | 'info' | 'seguimiento' | 'error' } {
  if (q.doc_status !== 'FINALIZED') return { texto: 'Pendiente', tono: 'aviso' };
  const comercial = ESTADOS.find((s) => s.id === q.commercial_status);
  return comercial ? { texto: comercial.texto, tono: comercial.tono } : { texto: 'Cerrado', tono: 'suave' }; // cerrado y aún sin enviar
}

// El «cuándo» de la fila: si hay que volver a llamar, el día (en rojo si es hoy o ya pasó); si no, cuándo se editó por última vez.
function cuandoDe(q: ResumenPresupuesto, t: Tema): { texto: string; color: string; fuerte: boolean } | null {
  const llamar = q.next_contact_date;
  if (llamar) {
    const hoy = enDias(0);
    if (llamar === hoy) return { texto: 'Llamar hoy', color: t.error, fuerte: true };
    if (llamar < hoy) return { texto: `Atrasado (${diaCorto(llamar)})`, color: t.error, fuerte: true };
    return { texto: `Llamar el ${diaCorto(llamar)}`, color: t.seguimiento, fuerte: true };
  }
  const hace = q.updated_at ? haceCuanto(q.updated_at) : ''; // los creados sin conexión aún no la traen
  return hace ? { texto: `editado ${hace}`, color: t.suave, fuerte: false } : null;
}

// Cada presupuesto es su propia tarjeta elevada de Material, con espacio entre una y otra (lo pone la lista). Tres renglones: cliente y
// monto; el trabajo, en gris; y el estado, el número y el cuándo.
// `sinCliente`: en la ficha del cliente su nombre sobra y se muestra el número del presupuesto.
// Eliminar = mantener apretada la fila: tras un instante (para no mostrarlo en un toque normal) una barra roja con «Eliminar» se va
// llenando de izquierda a derecha; al llenarse aparece la pregunta de confirmación. Soltar antes la cancela.
const ESPERA_MS = 220;
const LLENADO_MS = 800;
// La capa de Material que oscurece (o aclara, en oscuro) la fila mientras se aprieta; transición CSS de Reanimated, sin estado por cuadro.
const TRANSICION_CAPA = { transitionProperty: 'opacity', transitionDuration: 120 } as const;

// - `onEliminar`: un presupuesto pendiente se elimina manteniendo apretada su fila hasta que se llene la barra roja (los terminados no,
//   Contrato API §6). Siempre con confirmación.
// - `onCambiarEstado`: en uno ya enviado el estado es un botón que abre «Pasar a» con los demás estados (nunca el actual).
export function FilaPresupuesto({
  q,
  sinCliente = false,
  onEliminar,
  onCambiarEstado,
}: {
  q: ResumenPresupuesto;
  sinCliente?: boolean;
  onEliminar?: (q: ResumenPresupuesto) => void;
  onCambiarEstado?: (q: ResumenPresupuesto, estado: EstadoElegible) => void;
}) {
  const t = useTema();
  const { colors } = useTheme();
  const montoDe = useDinero(LISTA);
  const ocultos = useMontosOcultos(LISTA);
  const [presionado, setPresionado] = useState(false);
  const relleno = useSharedValue(0); // 0 a 1: cuánto se ha llenado la barra roja
  useEffect(() => {
    // FlashList recicla las filas: la barra de un presupuesto no debe quedar a medias en otro.
    cancelAnimation(relleno);
    relleno.set(0);
  }, [q.id, relleno]);
  const abrirYa = () => router.push({ pathname: '/presupuesto/[id]', params: { id: q.id } });
  const puedeEliminar = !!onEliminar && q.doc_status !== 'FINALIZED';
  const posibles = onCambiarEstado ? estadosPosibles(q) : [];
  const cambiar = (s: EstadoElegible) => {
    void Haptics.selectionAsync();
    onCambiarEstado?.(q, s);
  };

  const { dialogo, decidir } = useDialogo();
  const confirmar = () => {
    decidir(`¿Eliminar el presupuesto de ${q.customer.name}?`, 'Se borran también sus fotos, notas de voz y notas. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onEliminar?.(q) },
    ]);
  };
  // Un toque corto abre el presupuesto. No lo abre: soltar el dedo tras deslizar entre pestañas, ni soltarlo después de mantener
  // apretado (cuando ya empezó a llenarse la barra roja o ya preguntó si eliminar): eso es «eliminar», no «entrar».
  const desde = useRef(0); // cuándo se apretó la fila
  const abrir = () => {
    if (hayDeslizadoReciente()) return;
    if (puedeEliminar && Date.now() - desde.current > ESPERA_MS + 80) return;
    abrirYa();
  };
  // Al apretar, tras ESPERA_MS empieza a llenarse la barra; al llenarse, pide confirmar. Al soltar se vacía.
  const empezarLlenado = () => {
    if (!puedeEliminar) return;
    relleno.set(withDelay(ESPERA_MS, withTiming(1, { duration: LLENADO_MS, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(llenada);
    })));
  };
  const llenada = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    confirmar();
  };
  const soltar = () => {
    cancelAnimation(relleno);
    relleno.set(withTiming(0, { duration: 160 }));
  };
  const estiloRelleno = useAnimatedStyle(() => ({ transform: [{ scaleX: relleno.get() }] }));
  const estiloEtiqueta = useAnimatedStyle(() => ({ opacity: interpolate(relleno.get(), [0.12, 0.35], [0, 1], Extrapolation.CLAMP) }));
  const estado = estadoVisible(q);
  const color = t[estado.tono];
  const titulo = sinCliente ? (q.number ?? 'Sin número todavía') : q.customer.name;
  const monto = q.total > 0 ? montoDe(q.total, q.currency) : 'Sin ítems';
  // Cómo se nombra el presupuesto: su número CP una vez terminado; antes, el ID corto (se dicta letra por letra). Y la versión, si no es la primera.
  const codigo = [sinCliente ? q.code_id : (q.number ?? q.code_id), (q.version ?? 1) > 1 ? `v${q.version}` : null].filter(Boolean).join(' · ');
  const cuando = cuandoDe(q, t);
  const oscuro = t.oscuro;

  const etiquetaEstado = (
    <>
      <View style={[e.punto, { backgroundColor: color }]} />
      <Text variant="labelMedium" style={[e.textoEstado, { color }]}>{estado.texto}</Text>
    </>
  );
  // La fila es un botón de gesture-handler (no el de React Native): así comparte los gestos con el deslizado entre pestañas y, si el dedo
  // arrastra, el toque se cancela.
  const fila = (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={[titulo, ocultos && q.total > 0 ? 'monto oculto' : monto, estado.texto, codigo, cuando?.texto].filter(Boolean).join(', ')}
      accessibilityActions={puedeEliminar ? [{ name: 'delete', label: 'Eliminar' }] : posibles.map((s) => ({ name: s.id, label: `Pasar a ${s.texto}` }))}
      onAccessibilityAction={(a) => {
        if (a.nativeEvent.actionName === 'delete') confirmar();
        else cambiar(a.nativeEvent.actionName as EstadoElegible);
      }}
      onPress={abrir}
      onPressIn={() => {
        desde.current = Date.now();
        setPresionado(true);
        empezarLlenado();
      }}
      onPressOut={() => {
        setPresionado(false);
        soltar();
      }}
    >
      <View style={e.fila}>
        <Animated.View pointerEvents="none" style={[e.capa, TRANSICION_CAPA, { backgroundColor: t.texto, opacity: presionado ? 0.1 : 0 }]} />
        {puedeEliminar ? (
          <>
            <Animated.View pointerEvents="none" style={[e.capa, e.relleno, { backgroundColor: t.error }, estiloRelleno]} />
            <Animated.View pointerEvents="none" style={[e.capa, e.etiquetaEliminar, estiloEtiqueta]}>
              <Icono nombre="cerrar" tamano={18} color="#FFFFFF" />
              <Text variant="titleMedium" style={e.textoEliminar}>Eliminar</Text>
            </Animated.View>
          </>
        ) : null}
        <View style={e.arriba}>
          <Text variant="titleMedium" numberOfLines={1} style={[e.fuerte, e.flex]}>{titulo}</Text>
          <Text variant="titleMedium" style={[e.fuerte, e.cifra, q.total > 0 ? null : { color: t.suave }]}>{monto}</Text>
        </View>
        <Text variant="bodyMedium" numberOfLines={1} style={{ color: t.suave }}>{q.service_description || 'Sin descripción todavía'}</Text>
        <View style={e.abajo}>
          {/* El estado es una etiqueta tonal de su color (Material). Si se puede cambiar, es un botón que abre «Pasar a». */}
          {posibles.length > 0 ? (
            <Toque accessibilityRole="button" accessibilityLabel={`${estado.texto}. Cambiar estado`} hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }} onPress={() => elegirEstado(q, cambiar, decidir)} style={[e.estado, { backgroundColor: `${color}${oscuro ? '29' : '1A'}` }]}>
              {etiquetaEstado}
              <Icono nombre="despliegue" tamano={10} color={color} />
            </Toque>
          ) : (
            <View style={[e.estado, { backgroundColor: `${color}${oscuro ? '29' : '1A'}` }]}>{etiquetaEstado}</View>
          )}
          {codigo ? <Text variant="bodySmall" numberOfLines={1} style={[e.codigo, { color: t.suave }]}>{codigo}</Text> : null}
          {cuando ? (
            <>
              <Text variant="bodySmall" style={{ color: t.suave }}>·</Text>
              <Text variant="bodySmall" numberOfLines={1} style={[e.cuando, { color: cuando.color }, cuando.fuerte ? e.fuerte : null]}>{cuando.texto}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Toque>
  );
  // Dos capas: la de afuera es la superficie elevada (tono, esquinas, sombra y, en oscuro, el borde); la de adentro recorta la barra roja y
  // la capa del toque en las esquinas redondeadas. El margen a los lados lo pone la fila.
  return (
    <View style={e.margen}>
      <View style={[e.tarjeta, { backgroundColor: colors.elevation.level1 }, oscuro ? e.sombraOscura : e.sombraClara, oscuro && e.bordeOscuro]}>
        <View style={e.interior}>{fila}</View>
      </View>
      {dialogo}
    </View>
  );
}

const e = StyleSheet.create({
  margen: { paddingHorizontal: espacio.l },
  tarjeta: { borderRadius: radio.l, borderCurve: 'continuous' },
  // La sombra de una tarjeta de Material: suave en claro; en oscuro, más honda y con el borde claro de `bordeElevado` (theme-paper).
  sombraClara: { boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)' },
  sombraOscura: { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.55)' },
  bordeOscuro: { borderWidth: 1, borderColor: 'rgba(238, 242, 250, 0.16)' },
  interior: { overflow: 'hidden', borderRadius: radio.l, borderCurve: 'continuous' },
  fila: { paddingVertical: 14, paddingHorizontal: espacio.l, gap: 3, minHeight: MIN_TOQUE },
  capa: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  relleno: { transformOrigin: 'left' },
  etiquetaEliminar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s },
  textoEliminar: { color: '#FFFFFF', fontWeight: '700' },
  arriba: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.m },
  flex: { flex: 1 },
  fuerte: { fontWeight: '600' },
  cifra: { fontVariant: ['tabular-nums'] },
  abajo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  // Etiqueta de estado de Material, pequeña: 22 de alto (el toque se agranda con hitSlop).
  estado: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 22, paddingLeft: 7, paddingRight: 8, borderRadius: 11, marginRight: 2 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  textoEstado: { fontWeight: '600' },
  // El código corto se dicta letra por letra: va en monoespaciada. Cede espacio antes que el cuándo.
  codigo: { flexShrink: 1, fontFamily: Platform.select(MONO), letterSpacing: 0.3 },
  cuando: { flexShrink: 0 },
});
