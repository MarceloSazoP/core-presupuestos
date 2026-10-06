import * as Haptics from 'expo-haptics';
import { simboloUnidad } from '@/lib/unidades';
import { CampoModal } from '@/components/campo-modal';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Alert, Linking, Share, StyleSheet, Switch, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Chips, entero, ModalItem, numero, valorDe, type Fila } from '@/components/modal-item';
import { Boton, Campo, Pastilla, Presionable, Seccion, Tarjeta, Texto } from '@/components/ui';
import { dinero, montoEscrito, soloDigitos } from '@/lib/formato';
import { totalesDe } from '@/lib/totales';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Etapa 3 del wizard (CLAUDE.md §10): ítems, descuento, garantía y vigencia, y TERMINAR. Requiere conexión: los totales,
// el número y el PDF los calcula el servidor; aquí solo se captura y se muestra.
// Las duraciones: «sin garantía» es el interruptor apagado (kind NONE), no una opción más.
const GARANTIAS = [{ kind: 'D30', texto: '30 días' }, { kind: 'M3', texto: '3 meses' }, { kind: 'M6', texto: '6 meses' }, { kind: 'Y1', texto: '1 año' }, { kind: 'LIFETIME', texto: 'De por vida' }] as const;
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
  const [descuento, setDescuento] = useState(String(q.discount || ''));
  const [conIva, setConIva] = useState(q.include_vat);
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
  const clp = (n: number) => dinero(n, moneda); // los montos de este presupuesto, en su moneda
  const impuesto = q.vat_label ?? 'IVA';
  const tasa = q.vat_rate ?? 19;
  const { iva, total } = totalesDe(subtotal, entero(descuento), conIva, tasa);

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
      body: { discount: entero(descuento), include_vat: conIva, validity_days: Math.min(365, Math.max(1, entero(dias))), warranty: { kind: garantia }, observations: obs.trim() || null },
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
      {/* El total siempre a la vista, arriba, y es el real: con el impuesto incluido. Debajo se desglosa (neto + IVA, o el impuesto del país). */}
      <Tarjeta style={{ backgroundColor: t.kpi1Fondo, borderColor: t.borde }}>
        <View accessible accessibilityLabel={`Total ${clp(total)}${conIva ? `, con ${impuesto} incluido` : ''}`} style={e.bloqueTotal}>
        <View style={e.totalArriba}>
          <Texto fuerte style={{ color: t.kpi1Tinta }}>Total</Texto>
          <Texto variante="titulo" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[e.monto, e.totalMonto]}>{clp(total)}</Texto>
        </View>
        {conIva ? <Texto variante="chico" style={{ color: t.kpi1Tinta }}>{`Neto ${clp(total - iva)} + ${impuesto} (${tasa} %) ${clp(iva)}`}</Texto> : null}
        {entero(descuento) > 0 ? <Texto variante="chico" style={{ color: t.kpi1Tinta }}>{`Subtotal ${clp(subtotal)} · Descuento −${clp(entero(descuento))}`}</Texto> : null}
        </View>
      </Tarjeta>

      <Seccion titulo="Ítems y tareas" descripcion="Lo que cobras. Sale en el PDF.">
        {filas.length ? (
          <Tarjeta style={e.lista}>
            {/* Grilla: encabezado fijo y una fila por ítem o tarea; tocar una fila abre su hoja. */}
            <View style={[e.filaLista, e.encabezado, { backgroundColor: t.campo, borderBottomColor: t.borde }]}>
              <Texto variante="chico" suave fuerte style={e.colDesc}>Descripción</Texto>
              <Texto variante="chico" suave fuerte style={e.colCant}>Cant.</Texto>
              <Texto variante="chico" suave fuerte style={e.colMonto}>Total</Texto>
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
                  <Texto numberOfLines={2} suave={!f.description.trim()}>{f.description.trim() || (f.tipo === 'tarea' ? 'Tarea sin descripción' : 'Ítem sin descripción')}</Texto>
                  {f.tipo === 'item' ? <Texto variante="chico" suave numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={e.monto}>{clp(entero(f.unit_price))} c/u</Texto> : null}
                </View>
                <Texto suave numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[e.colCant, e.monto]}>{f.tipo === 'tarea' ? 'Tarea' : `${String(f.quantity).replace('.', ',')} ${simboloUnidad(f.unit)}`}</Texto>
                <Texto fuerte numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[e.colMonto, e.monto]}>{f.tipo === 'tarea' && !f.unit_price ? 'Incluido' : clp(valorDe(f))}</Texto>
              </Presionable>
              </Animated.View>
            ))}
          </Tarjeta>
        ) : (
          <Tarjeta>
            <Texto suave>Aún no agregas nada. Toca «Ítem» para lo que vendes (con cantidad y precio) o «Tarea» para algo que haces sin cantidad, como botar escombros.</Texto>
          </Tarjeta>
        )}
        <View style={e.fila}>
          <Boton titulo="Ítem" accessibilityLabel="Agregar ítem" prefijo="+" icono="caja" colorIcono={t.kpi1Tinta} variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('item')} style={e.mitad} />
          <Boton titulo="Tarea" accessibilityLabel="Agregar tarea" prefijo="+" icono="tarea" colorIcono={t.kpi3Tinta} variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('tarea')} style={e.mitad} />
        </View>
      </Seccion>

      {/* Todo lo que se acuerda con el cliente, en una sola tarjeta: descuento, impuesto, garantía, validez y observaciones. */}
      <Seccion titulo="Condiciones">
        <Tarjeta>
          <Campo etiqueta="Descuento (opcional)" value={montoEscrito(descuento, moneda)} onChangeText={(v) => setDescuento(soloDigitos(v))} keyboardType="number-pad" placeholder="$ 0" />
          <View style={e.filaIva}>
            <Texto style={e.textoIva}>Agregar {impuesto} ({tasa}%)</Texto>
            <Switch accessibilityLabel={`Agregar ${impuesto} (${tasa}%)`} value={conIva} onValueChange={setConIva} trackColor={{ true: t.acento }} />
          </View>
          {/* Un interruptor: apagado es «sin garantía»; al encenderlo aparecen las duraciones (30 días por defecto). */}
          <View style={e.filaIva}>
            <Texto style={e.textoIva}>Garantía</Texto>
            <Switch accessibilityLabel="Garantía" value={garantia !== 'NONE'} onValueChange={(on) => setGarantia(on ? 'D30' : 'NONE')} trackColor={{ true: t.acento }} />
          </View>
          {garantia !== 'NONE' ? (
            <View style={e.grupo}>
              <Texto variante="chico" fuerte>Duración</Texto>
              <Chips etiqueta="Duración de la garantía" opciones={GARANTIAS.map((g) => ({ id: g.kind, texto: g.texto }))} valor={garantia} alElegir={setGarantia} />
            </View>
          ) : null}
          <Campo etiqueta="Validez del presupuesto (días)" value={dias} onChangeText={(v) => setDias(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          <CampoModal etiqueta="Observaciones (opcional)" titulo="Observaciones" agregar="Agregar observaciones" valor={obs} alCambiar={setObs} maxLength={5000} placeholder="Plazos, forma de pago, lo que incluye…" />
        </Tarjeta>
      </Seccion>

      {/* Las acciones van fuera de las tarjetas, separadas, en la zona del pulgar. */}
      <View style={e.acciones}>
        {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
        <Boton titulo="Terminar presupuesto" icono="listo" onPress={pedirTerminar} cargando={trabajando === 'terminar'} disabled={trabajando !== null} />
        <Boton titulo="Guardar y volver" variante="secundario" onPress={() => void correr('guardar')} cargando={trabajando === 'guardar'} disabled={trabajando !== null} />
        <Texto variante="chico" suave style={e.centrado}>Al terminar se numera y se genera el PDF. Después ya no se puede editar.</Texto>
      </View>

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
    <Tarjeta>
      <Pastilla texto={enviado ? 'Enviado al cliente' : 'Listo para enviar'} tono={enviado ? 'ok' : 'aviso'} />
      <Texto variante="subtitulo" accessibilityRole="header">Enviar al cliente</Texto>
      <Texto suave>Tu cliente recibe el PDF y un enlace de solo lectura. No puede editar nada.</Texto>
      {q.public_url ? <Boton titulo="Compartir" icono="compartir" onPress={() => void compartir()} /> : null}
      <Boton titulo="WhatsApp" icono="mensaje" variante="secundario" onPress={() => void whatsapp()} />
      {q.customer.email ? <Boton titulo="Enviar por correo" icono="correo" variante="secundario" onPress={correo} cargando={ocupado} disabled={ocupado} /> : <Texto variante="chico" suave>El cliente no tiene correo guardado.</Texto>}
      {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  bloqueTotal: { gap: espacio.xs },
  totalArriba: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
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
  total: { borderTopWidth: 2, paddingTop: espacio.m, marginTop: espacio.xs },
  acciones: { gap: espacio.m, paddingTop: espacio.s },
  monto: { fontVariant: ['tabular-nums'] },
  centrado: { textAlign: 'center' },
});
