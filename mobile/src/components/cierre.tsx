import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Pastilla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { clp, montoEscrito, soloDigitos } from '@/lib/formato';
import { totalesDe } from '@/lib/totales';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Etapa 3 del wizard (CLAUDE.md §10): ítems, descuento, garantía y vigencia, y TERMINAR. Requiere conexión: los totales,
// el número y el PDF los calcula el servidor; aquí solo se captura y se muestra.
const UNIDADES = ['un', 'm', 'm2', 'ml', 'kg', 'hr', 'jornada', 'servicio', 'gl'] as const; // las más usadas; el servidor acepta más (Contrato API §12.1)
const GARANTIAS = [
  { kind: 'NONE', texto: 'Sin garantía' }, { kind: 'D30', texto: '30 días' }, { kind: 'M3', texto: '3 meses' },
  { kind: 'M6', texto: '6 meses' }, { kind: 'Y1', texto: '1 año' },
] as const;
const MAX_ITEMS = 100;

// `tipo`: un ítem es cantidad × precio; una tarea (botar escombros, limpiar bodega) no tiene cantidad ni unidad y su valor
// es opcional: vacío = incluida en el presupuesto.
type Fila = { clave: string; tipo: 'item' | 'tarea'; description: string; quantity: string; unit: string; unit_price: string };

const numero = (s: string) => Number(s.replace(',', '.'));
const entero = (s: string) => Number(s.replace(/\D/g, '') || 0);

function Chips<T extends string>({ opciones, valor, alElegir, etiqueta }: { opciones: readonly { id: T; texto: string }[]; valor: string; alElegir: (v: T) => void; etiqueta: string }) {
  const t = useTema();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={etiqueta} contentContainerStyle={e.chips}>
      {opciones.map((o) => {
        const elegido = o.id === valor;
        return (
          <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: elegido }} onPress={() => alElegir(o.id)} style={({ pressed }) => [e.chip, { borderColor: elegido ? t.acento : t.bordeCampo, backgroundColor: elegido ? t.acento : t.campo, opacity: pressed ? 0.7 : 1 }]}>
            <Texto color={elegido ? 'sobreAcento' : 'texto'} fuerte={elegido}>{o.texto}</Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Cierre({ q, recargar }: { q: Presupuesto; recargar: () => Promise<void> }) {
  const t = useTema();
  const contador = useRef(0);
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

  const cambiar = (clave: string, campo: keyof Fila, v: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: v } : f)));
  const valorDe = (f: Fila) => (f.tipo === 'tarea' ? entero(f.unit_price) : Math.round(numero(f.quantity) * entero(f.unit_price)) || 0);
  const subtotal = filas.reduce((s, f) => s + valorDe(f), 0); // vista previa; manda el servidor
  const agregar = (tipo: Fila['tipo']) => setFilas((fs) => [...fs, { clave: `n${++contador.current}`, tipo, description: '', quantity: '1', unit: 'un', unit_price: '' }]);
  const { iva, total } = totalesDe(subtotal, entero(descuento), conIva);

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
      <Seccion titulo="Ítems y tareas" descripcion="Lo que cobras. Sale en el PDF.">
        {filas.map((f, n) => f.tipo === 'tarea' ? (
          <Tarjeta key={f.clave}>
            <Pastilla texto="Tarea" tono="suave" />
            <Campo etiqueta={`Tarea (línea ${n + 1})`} value={f.description} onChangeText={(v) => cambiar(f.clave, 'description', v)} placeholder="Por ejemplo: botar escombros" maxLength={300} />
            <Campo etiqueta="Valor (opcional)" value={montoEscrito(f.unit_price)} onChangeText={(v) => cambiar(f.clave, 'unit_price', soloDigitos(v))} keyboardType="number-pad" placeholder="$ 0" ayuda="Si lo dejas vacío, la tarea va incluida en el presupuesto." />
            <View style={[e.pie, { borderTopColor: t.borde }]}>
              <Texto fuerte style={e.monto}>{f.unit_price ? clp(entero(f.unit_price)) : 'Incluido'}</Texto>
              <Boton titulo="Quitar" icono="cerrar" variante="texto" onPress={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))} />
            </View>
          </Tarjeta>
        ) : (
          <Tarjeta key={f.clave}>
            <Campo etiqueta={`Ítem (línea ${n + 1})`} value={f.description} onChangeText={(v) => cambiar(f.clave, 'description', v)} placeholder="Qué vas a hacer o vender" maxLength={300} />
            <View style={e.fila}>
              <View style={e.mitad}><Campo etiqueta="Cantidad" value={f.quantity} onChangeText={(v) => cambiar(f.clave, 'quantity', v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" /></View>
              <View style={e.mitad}><Campo etiqueta="Precio unitario" value={montoEscrito(f.unit_price)} onChangeText={(v) => cambiar(f.clave, 'unit_price', soloDigitos(v))} keyboardType="number-pad" placeholder="$ 0" /></View>
            </View>
            <Chips etiqueta="Unidad" opciones={UNIDADES.map((u) => ({ id: u, texto: u === 'm2' ? 'm²' : u }))} valor={f.unit} alElegir={(u) => cambiar(f.clave, 'unit', u)} />
            <View style={[e.pie, { borderTopColor: t.borde }]}>
              <Texto fuerte style={e.monto}>{clp(Math.round(numero(f.quantity) * entero(f.unit_price)) || 0)}</Texto>
              <Boton titulo="Quitar" icono="cerrar" variante="texto" onPress={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))} />
            </View>
          </Tarjeta>
        ))}
        <View style={e.fila}>
          <Boton titulo="Ítem" accessibilityLabel="Agregar ítem" icono="mas" variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('item')} style={e.mitad} />
          <Boton titulo="Tarea" accessibilityLabel="Agregar tarea" icono="mas" variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('tarea')} style={e.mitad} />
        </View>
      </Seccion>

      <Seccion titulo="Condiciones">
        <Tarjeta>
          <Campo etiqueta="Descuento (opcional)" value={montoEscrito(descuento)} onChangeText={(v) => setDescuento(soloDigitos(v))} keyboardType="number-pad" placeholder="$ 0" />
          <View style={e.filaIva}>
            <Texto style={e.textoIva}>Agregar IVA (19%)</Texto>
            <Switch accessibilityLabel="Agregar IVA (19%)" value={conIva} onValueChange={setConIva} trackColor={{ true: t.acento }} />
          </View>
          <View style={e.grupo}>
            <Texto variante="chico" fuerte>Garantía</Texto>
            <Chips etiqueta="Garantía" opciones={GARANTIAS.map((g) => ({ id: g.kind, texto: g.texto }))} valor={garantia} alElegir={setGarantia} />
          </View>
          <Campo etiqueta="Validez del presupuesto (días)" value={dias} onChangeText={(v) => setDias(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          <Campo etiqueta="Observaciones (opcional)" value={obs} onChangeText={setObs} multiline maxLength={5000} placeholder="Condiciones, plazos, forma de pago…" />
        </Tarjeta>
      </Seccion>

      {/* Resumen: el total manda, y la acción de terminar va justo debajo, en la zona del pulgar. */}
      <Tarjeta>
        <View style={e.filaTotal}>
          <Texto suave>Subtotal</Texto>
          <Texto suave style={e.monto}>{clp(subtotal)}</Texto>
        </View>
        {entero(descuento) > 0 ? (
          <View style={e.filaTotal}>
            <Texto suave>Descuento</Texto>
            <Texto suave style={e.monto}>−{clp(entero(descuento))}</Texto>
          </View>
        ) : null}
        {conIva ? (
          <View style={e.filaTotal}>
            <Texto suave>IVA (19%)</Texto>
            <Texto suave style={e.monto}>{clp(iva)}</Texto>
          </View>
        ) : null}
        <View style={[e.filaTotal, e.total, { borderTopColor: t.texto }]}>
          <Texto fuerte>Total</Texto>
          <Texto variante="titulo" style={e.monto}>{clp(total)}</Texto>
        </View>
        {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
        <Boton titulo="Terminar presupuesto" icono="listo" onPress={pedirTerminar} cargando={trabajando === 'terminar'} disabled={trabajando !== null} />
        <Boton titulo="Guardar y volver" variante="secundario" onPress={() => void correr('guardar')} cargando={trabajando === 'guardar'} disabled={trabajando !== null} />
        <Texto variante="chico" suave style={e.centrado}>Al terminar se numera y se genera el PDF. Después ya no se puede editar.</Texto>
      </Tarjeta>
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
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espacio.s },
  mitad: { flex: 1 },
  grupo: { gap: espacio.s },
  filaIva: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  textoIva: { flex: 1 },
  chips: { gap: espacio.s },
  chip: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.l, alignItems: 'center', justifyContent: 'center' },
  filaTotal: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
  total: { borderTopWidth: 2, paddingTop: espacio.m, marginTop: espacio.xs },
  monto: { fontVariant: ['tabular-nums'] },
  centrado: { textAlign: 'center' },
});
