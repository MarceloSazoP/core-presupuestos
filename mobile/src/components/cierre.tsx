import * as Haptics from 'expo-haptics';
import { GARANTIAS, ModalCondiciones } from '@/components/modal-condiciones';
import { IconoDinero } from '@/components/icono-dinero';
import { BotonOjo } from '@/components/boton-ojo';
import { delPresupuesto, useDinero } from '@/lib/montos';
import { BarraFlotante } from '@/components/barra-flotante';
import { montoDeDescuento, porcentajeDe } from '@/lib/descuento';
import { avisar } from '@/lib/toast';
import { simboloUnidad } from '@/lib/unidades';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { entero, ModalItem, numero, valorDe, type Fila } from '@/components/modal-item';
import { BotonM, PastillaM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { Icono, Presionable } from '@/components/ui';
import { totalesDe } from '@/lib/totales';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Etapa 3 del wizard (CLAUDE.md §10): ítems, descuento, garantía y vigencia, y TERMINAR. Requiere conexión: los totales,
// el número y el PDF los calcula el servidor; aquí solo se captura y se muestra.
// Las duraciones: «sin garantía» es el interruptor apagado (kind NONE), no una opción más.
const MAX_ITEMS = 100;

export function Cierre({ q, recargar, alTerminar }: { q: Presupuesto; recargar: () => Promise<void>; alTerminar?: () => void }) {
  const t = useTema();
  const contador = useRef(0);
  // Ítem o tarea abierto en la hoja: `nueva` si todavía no está en la lista (se agrega al guardar).
  const [abierta, setAbierta] = useState<{ fila: Fila; nueva: boolean } | null>(null);
  const [filas, setFilas] = useState<Fila[]>(() =>
    q.items.map((i) => {
      const tarea = i.kind === 'TASK';
      return { clave: i.id, tipo: tarea ? 'tarea' : 'item', description: i.description, quantity: String(i.quantity), unit: i.unit, unit_price: tarea && i.unit_price === 0 ? '' : String(i.unit_price) };
    }),
  );
  const [pct, setPct] = useState<number | null>(() => porcentajeDe(q.discount, q.subtotal)); // null: un monto fijo de antes
  const [conIva, setConIva] = useState(q.include_vat);
  const [condiciones, setCondiciones] = useState(false); // la ventana de condiciones
  const [dias, setDias] = useState(String(q.validity_days ?? 15));
  const [garantia, setGarantia] = useState<string>(q.warranty.kind === 'CUSTOM' ? 'NONE' : q.warranty.kind);
  const [obs, setObs] = useState(q.observations ?? '');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<'guardar' | 'terminar' | null>(null);

  const subtotal = filas.reduce((s, f) => s + valorDe(f), 0); // vista previa; manda el servidor
  const agregar = (tipo: Fila['tipo']) => setAbierta({ nueva: true, fila: { clave: `n${++contador.current}`, tipo, description: '', quantity: '1', unit: 'un', unit_price: '' } });
  const [recien, setRecien] = useState<string | null>(null); // la fila recién agregada entra con un fundido; las que ya estaban no se mueven
  const guardarFila = (f: Fila) => {
    if (!filas.some((x) => x.clave === f.clave)) setRecien(f.clave);
    setFilas((fs) => (fs.some((x) => x.clave === f.clave) ? fs.map((x) => (x.clave === f.clave ? f : x)) : [...fs, f]));
    void Haptics.selectionAsync();
    setAbierta(null);
  };
  const moneda = q.currency ?? 'CLP';
  const montoDe = useDinero(delPresupuesto(q.id));
  const clp = (n: number) => montoDe(n, moneda); // los montos de este presupuesto, en su moneda (o puntos si están ocultos)
  const impuesto = q.vat_label ?? 'IVA';
  const tasa = q.vat_rate ?? 19;
  const desc = pct === null ? q.discount : montoDeDescuento(subtotal, pct); // el servidor guarda el monto; aquí se elige en porcentaje
  const { iva, total } = totalesDe(subtotal, desc, conIva, tasa);
  const resumenCondiciones = [
    desc > 0 ? (pct ? `Descuento ${pct} %` : 'Descuento fijo') : null,
    garantia === 'NONE' ? 'Sin garantía' : `Garantía ${GARANTIAS.find((g) => g.kind === garantia)?.texto ?? ''}`,
    `Validez ${dias || '—'} días`,
    obs.trim() ? 'Con observaciones' : null,
  ].filter(Boolean).join(' · ');
  const detalle = conIva || desc > 0; // con impuesto o descuento, el cuadro desglosa; si no, dice solo «Total»

  async function guardar() {
    const llenas = filas.filter((f) => f.description.trim());
    if (llenas.some((f) => f.tipo === 'item' && !(numero(f.quantity) > 0))) throw new Error('Cada ítem necesita una cantidad mayor que 0.');
    const items = llenas.map((f) =>
      f.tipo === 'tarea'
        ? { kind: 'TASK', description: f.description.trim(), unit_price: entero(f.unit_price) }
        : { kind: 'ITEM', description: f.description.trim(), quantity: numero(f.quantity), unit: f.unit, unit_price: entero(f.unit_price) },
    );
    await api(`/quotes/${q.id}/items`, { method: 'PUT', body: { items } });
    await api(`/quotes/${q.id}`, {
      method: 'PATCH',
      body: { discount: desc, include_vat: conIva, validity_days: Math.min(365, Math.max(1, entero(dias))), warranty: { kind: garantia }, observations: obs.trim() || null },
    });
  }

  async function correr(que: 'guardar' | 'terminar') {
    setTrabajando(que);
    setError(null);
    try {
      await asegurarSincronizado(q.id, que === 'terminar' ? 'todo' : 'creacion'); // terminar exige que fotos y voz ya estén arriba
      await guardar();
      if (que === 'terminar') {
        await api(`/quotes/${q.id}/finalize`, { method: 'POST', body: {} });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alTerminar?.();
      }
      await recargar();
      // «Guardar y volver» deja el presupuesto pendiente (ya visible en la web) y vuelve a la lista; «Terminar» se queda para mostrar el envío.
      if (que === 'guardar') {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error && !('status' in err) ? err.message : mensajeDe(err));
    } finally {
      setTrabajando(null);
    }
  }

  const pedirTerminar = () =>
    Alert.alert('¿Terminar el presupuesto?', 'Se le asigna su número y se genera el PDF. Después ya no se puede editar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Terminar', onPress: () => void correr('terminar') },
    ]);

  return (
    <>
      {/* El total siempre a la vista, arriba, y es el real. Como las tarjetas del inicio: fondo neutro, un ícono de dinero con su color y las
          palabras en ese color; las cifras en el color del texto (blanco en oscuro). Sin impuesto ni descuento dice solo «Total»; si no se
          desglosa: subtotal, descuento (con su %), impuesto y total. */}
      <TarjetaM>
        <View accessible accessibilityLabel={detalle ? `Subtotal ${clp(subtotal)}.${desc > 0 ? ` Descuento${pct ? ` ${pct} por ciento` : ''} ${clp(desc)}.` : ''}${conIva ? ` ${impuesto} ${tasa} por ciento, ${clp(iva)}.` : ''} Total ${clp(total)}.` : `Total ${clp(total)}.`} style={e.bloqueTotal}>
          {detalle ? (
            <>
              <View style={e.filaDesglose}>
                <TextoM variante="chico" fuerte style={{ color: t.totalTinta }}>Subtotal</TextoM>
                <TextoM fuerte style={e.monto}>{clp(subtotal)}</TextoM>
              </View>
              {desc > 0 ? (
                <View style={e.filaDesglose}>
                  <TextoM variante="chico" fuerte style={{ color: t.totalTinta }}>{pct ? `Descuento ${pct} %` : 'Descuento'}</TextoM>
                  <TextoM fuerte style={e.monto}>−{clp(desc)}</TextoM>
                </View>
              ) : null}
              {conIva ? (
                <View style={e.filaDesglose}>
                  <TextoM variante="chico" fuerte style={{ color: t.totalTinta }}>{impuesto} {tasa}%</TextoM>
                  <TextoM fuerte style={e.monto}>{clp(iva)}</TextoM>
                </View>
              ) : null}
            </>
          ) : null}
          <View style={[e.filaDesglose, detalle && e.total, detalle && { borderTopColor: t.borde }]}>
            <View style={e.etiquetaTotal}>
              <IconoDinero tamano={36} />
              <TextoM fuerte style={{ color: t.totalTinta }}>Total</TextoM>
              <BotonOjo clave={delPresupuesto(q.id)} color={t.totalTinta} chico />
            </View>
            <TextoM variante="titulo" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[e.monto, e.totalMonto]}>{clp(total)}</TextoM>
          </View>
        </View>
        {/* El impuesto va aquí, justo bajo el total, porque es lo que lo cambia. */}
        <View style={[e.filaIva, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde, paddingTop: espacio.m }]}>
          <TextoM style={e.textoIva}>Agregar {impuesto} ({tasa}%)</TextoM>
          <Switch accessibilityLabel={`Agregar ${impuesto} (${tasa}%)`} value={conIva} onValueChange={(on) => { setConIva(on); avisar.info(on ? `${impuesto} agregado` : `${impuesto} quitado`, on ? `El total ahora lleva ${impuesto} (${tasa} %).` : 'El total queda sin impuesto.'); }} color={t.acento} />
        </View>
      </TarjetaM>

      <SeccionM titulo="Ítems y tareas" icono="lista" descripcion="Lo que cobras. Sale en el PDF.">
        {filas.length ? (
          <TarjetaM sinRelleno>
            {/* Grilla: encabezado fijo y una fila por ítem o tarea; tocar una fila abre su hoja. */}
            <View style={[e.filaLista, e.encabezado, { backgroundColor: t.campo, borderBottomColor: t.borde }]}>
              <TextoM variante="chico" suave fuerte style={e.colDesc}>Descripción</TextoM>
              <TextoM variante="chico" suave fuerte style={e.colCant}>Cant.</TextoM>
              <TextoM variante="chico" suave fuerte style={e.colMonto}>Total</TextoM>
            </View>
            {filas.map((f, n) => (
              <Animated.View key={f.clave} entering={f.clave === recien ? FadeIn.duration(180) : undefined}>
              <Presionable
                accessibilityRole="button"
                accessibilityLabel={`${f.tipo === 'tarea' ? 'Tarea' : 'Ítem'} ${n + 1}: ${f.description || 'sin descripción'}. Editar`}
                onPress={() => setAbierta({ fila: f, nueva: false })}
                estilo={[e.filaLista, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }]}
              >
                <View style={e.colDesc}>
                  <TextoM numberOfLines={2} suave={!f.description.trim()}>{f.description.trim() || (f.tipo === 'tarea' ? 'Tarea sin descripción' : 'Ítem sin descripción')}</TextoM>
                  {f.tipo === 'item' ? <TextoM variante="chico" suave numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={e.monto}>{clp(entero(f.unit_price))} c/u</TextoM> : null}
                </View>
                <TextoM suave numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[e.colCant, e.monto]}>{f.tipo === 'tarea' ? 'Tarea' : `${String(f.quantity).replace('.', ',')} ${simboloUnidad(f.unit)}`}</TextoM>
                <TextoM fuerte numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[e.colMonto, e.monto]}>{f.tipo === 'tarea' && !f.unit_price ? 'Incluido' : clp(valorDe(f))}</TextoM>
              </Presionable>
              </Animated.View>
            ))}
          </TarjetaM>
        ) : (
          <TarjetaM>
            <TextoM suave>Aún no agregas nada. Toca «Ítem» para lo que vendes (con cantidad y precio) o «Tarea» para algo que haces sin cantidad, como botar escombros.</TextoM>
          </TarjetaM>
        )}
        <View style={e.fila}>
          <BotonM titulo="Ítem" accessibilityLabel="Agregar ítem" prefijo="+" icono="caja" colorIcono={t.kpi1Tinta} variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('item')} style={e.mitad} />
          <BotonM titulo="Tarea" accessibilityLabel="Agregar tarea" prefijo="+" icono="tarea" colorIcono={t.kpi3Tinta} variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('tarea')} style={e.mitad} />
        </View>
      </SeccionM>

      {/* Todo lo que se acuerda con el cliente, en una sola tarjeta: descuento, impuesto, garantía, validez y observaciones. */}
      {/* Las condiciones (descuento, garantía, validez y observaciones) viven en su propia ventana; aquí solo su resumen. */}
      <SeccionM titulo="Condiciones" icono="documento" descripcion="Descuento, garantía, validez y observaciones.">
        <TarjetaM sinRelleno>
          <Presionable accessibilityRole="button" accessibilityLabel={`Condiciones: ${resumenCondiciones}. Editar`} onPress={() => setCondiciones(true)} estilo={e.filaCondiciones}>
            <TextoM style={e.flexTexto}>{resumenCondiciones}</TextoM>
            <Icono nombre="siguiente" tamano={14} color={t.suave} />
          </Presionable>
        </TarjetaM>
      </SeccionM>

      <TextoM variante="chico" suave style={e.centrado}>Al terminar se numera y se genera el PDF. Después ya no se puede editar.</TextoM>

      {/* Las acciones flotan al pie mientras queda formulario por ver y, al llegar al final, se quedan en su sitio sin tapar nada. */}
      <BarraFlotante reserva={RESERVA_BARRA}>
        {error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM> : null}
        <View style={e.fila}>
          <BotonM titulo="Guardar" icono="guardar" variante="secundario" onPress={() => void correr('guardar')} cargando={trabajando === 'guardar'} disabled={trabajando !== null} style={e.mitad} accessibilityLabel="Guardar y volver" />
          <BotonM titulo="Terminar presupuesto" icono="listo" onPress={pedirTerminar} cargando={trabajando === 'terminar'} disabled={trabajando !== null} style={e.mayor} />
        </View>
      </BarraFlotante>

      {condiciones ? (
        <ModalCondiciones pct={pct} alDescuento={setPct} descuentoFijo={`Descuento fijo ${clp(q.discount)}`} garantia={garantia} alGarantia={setGarantia} dias={dias} alDias={setDias} obs={obs} alObs={setObs} alCerrar={() => setCondiciones(false)} />
      ) : null}

      {abierta ? (
        <ModalItem
          moneda={moneda}
          key={abierta.fila.clave}
          fila={abierta.fila}
          nueva={abierta.nueva}
          alGuardar={guardarFila}
          alQuitar={() => {
            setFilas((fs) => fs.filter((x) => x.clave !== abierta.fila.clave));
            setAbierta(null);
          }}
          alCerrar={() => setAbierta(null)}
        />
      ) : null}
    </>
  );
}

// Presupuesto terminado: enviarlo. El PDF y el enlace público los generó el servidor al terminar.
export function Envio({ q, recargar }: { q: Presupuesto; recargar: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviado = q.commercial_status !== 'NONE';

  async function avisar(ruta: string, body: unknown = {}) {
    try {
      await asegurarSincronizado(q.id);
      await api(`/quotes/${q.id}/${ruta}`, { method: 'POST', body });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await recargar();
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  const confirmar = (titulo: string, ok: string, alConfirmar: () => void) =>
    Alert.alert(titulo, undefined, [{ text: 'No', style: 'cancel' }, { text: ok, onPress: alConfirmar }]);

  const mensaje = `Hola ${q.customer.name}, te comparto tu presupuesto ${q.number}: ${q.public_url}`;

  async function compartir() {
    const r = await Share.share({ message: mensaje });
    if (r.action === Share.sharedAction) await avisar('mark-sent', { channel: 'SHARE' });
  }

  async function whatsapp() {
    const tel = q.customer.phone.replace(/\D/g, '');
    try {
      await Linking.openURL(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`);
    } catch {
      return setError('No se pudo abrir WhatsApp.');
    }
    confirmar('¿Enviaste el mensaje?', 'Sí, enviado', () => void avisar('mark-sent', { channel: 'WHATSAPP' }));
  }

  const correo = () =>
    confirmar(`¿Enviar a ${q.customer.email}?`, 'Enviar', () => {
      setOcupado(true);
      void avisar('send-email').finally(() => setOcupado(false));
    });

  return (
    <TarjetaM>
      <PastillaM texto={enviado ? 'Enviado al cliente' : 'Listo para enviar'} tono={enviado ? 'ok' : 'aviso'} />
      <TextoM variante="subtitulo" accessibilityRole="header">Enviar al cliente</TextoM>
      <TextoM suave>Tu cliente recibe el PDF y un enlace de solo lectura. No puede editar nada.</TextoM>
      {q.public_url ? <BotonM titulo="Compartir" icono="compartir" onPress={() => void compartir()} /> : null}
      <BotonM titulo="WhatsApp" icono="mensaje" variante="secundario" onPress={() => void whatsapp()} />
      {q.customer.email ? <BotonM titulo="Enviar por correo" icono="correo" variante="secundario" onPress={correo} cargando={ocupado} disabled={ocupado} /> : <TextoM variante="chico" suave>El cliente no tiene correo guardado.</TextoM>}
      {error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM> : null}
    </TarjetaM>
  );
}

const RESERVA_BARRA = espacio.xxl * 2; // igual al paddingBottom del contenido de la pantalla del presupuesto
const e = StyleSheet.create({
  tarjetaCondiciones: { padding: 0 },
  filaCondiciones: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l, paddingVertical: espacio.m },
  flexTexto: { flex: 1 },
  etiquetaTotal: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  bloqueTotal: { gap: espacio.s },
  filaDesglose: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  totalMonto: { flexShrink: 1, textAlign: 'right' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  flex: { flex: 1 },
  encabezado: { minHeight: 36, paddingVertical: espacio.s, borderBottomWidth: StyleSheet.hairlineWidth },
  colDesc: { flex: 1 },
  colCant: { width: 72, textAlign: 'right' },
  colMonto: { width: 104, textAlign: 'right' },
  lista: { padding: 0, gap: 0, overflow: 'hidden' },
  filaLista: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: espacio.m, paddingHorizontal: espacio.l },
  mitad: { flex: 1 },
  grupo: { gap: espacio.s },
  filaIva: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  textoIva: { flex: 1 },
  filaTotal: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
  totales: { gap: espacio.s, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espacio.m },
  total: { borderTopWidth: 1, paddingTop: espacio.m, marginTop: espacio.xs },
  mayor: { flex: 1.6 },
  monto: { fontVariant: ['tabular-nums'] },
  centrado: { textAlign: 'center' },
});
