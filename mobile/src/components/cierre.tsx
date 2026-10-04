import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Pastilla, Texto } from '@/components/ui';
import { clp } from '@/lib/formato';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Etapa 3 del wizard (CLAUDE.md §10): ítems, descuento, garantía y vigencia, y TERMINAR. Requiere conexión: los totales,
// el número y el PDF los calcula el servidor; aquí solo se captura y se muestra.
const UNIDADES = ['un', 'm', 'm2', 'ml', 'kg', 'hr', 'jornada', 'servicio', 'gl'] as const; // las más usadas; el servidor acepta más (Contrato API §12.1)
const GARANTIAS = [
  { kind: 'NONE', texto: 'Sin garantía' }, { kind: 'D30', texto: '30 días' }, { kind: 'M3', texto: '3 meses' },
  { kind: 'M6', texto: '6 meses' }, { kind: 'Y1', texto: '1 año' },
] as const;
const MAX_ITEMS = 100;

type Fila = { clave: string; description: string; quantity: string; unit: string; unit_price: string };

const numero = (s: string) => Number(s.replace(',', '.'));
const entero = (s: string) => Number(s.replace(/\D/g, '') || 0);

function Chips<T extends string>({ opciones, valor, alElegir, etiqueta }: { opciones: readonly { id: T; texto: string }[]; valor: string; alElegir: (v: T) => void; etiqueta: string }) {
  const t = useTema();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={etiqueta} contentContainerStyle={e.chips}>
      {opciones.map((o) => {
        const elegido = o.id === valor;
        return (
          <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: elegido }} onPress={() => alElegir(o.id)} style={[e.chip, { borderColor: elegido ? t.acento : t.borde, backgroundColor: elegido ? t.acento : t.tarjeta }]}>
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
  const [filas, setFilas] = useState<Fila[]>(() => q.items.map((i) => ({ clave: i.id, description: i.description, quantity: String(i.quantity), unit: i.unit, unit_price: String(i.unit_price) })));
  const [descuento, setDescuento] = useState(String(q.discount || ''));
  const [dias, setDias] = useState(String(q.validity_days ?? 15));
  const [garantia, setGarantia] = useState<string>(q.warranty.kind === 'CUSTOM' ? 'NONE' : q.warranty.kind);
  const [obs, setObs] = useState(q.observations ?? '');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<'guardar' | 'terminar' | null>(null);

  const cambiar = (clave: string, campo: keyof Fila, v: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: v } : f)));
  const subtotal = filas.reduce((s, f) => s + Math.round(numero(f.quantity) * entero(f.unit_price) || 0), 0); // vista previa; manda el servidor
  const total = Math.max(0, subtotal - entero(descuento));

  async function guardar() {
    const items = filas.filter((f) => f.description.trim()).map((f) => ({ description: f.description.trim(), quantity: numero(f.quantity), unit: f.unit, unit_price: entero(f.unit_price) }));
    if (items.some((i) => !(i.quantity > 0))) throw new Error('Cada ítem necesita una cantidad mayor que 0.');
    await api(`/quotes/${q.id}/items`, { method: 'PUT', body: { items } });
    await api(`/quotes/${q.id}`, {
      method: 'PATCH',
      body: { discount: entero(descuento), validity_days: Math.min(365, Math.max(1, entero(dias))), warranty: { kind: garantia }, observations: obs.trim() || null },
    });
  }

  async function correr(que: 'guardar' | 'terminar') {
    setTrabajando(que);
    setError(null);
    try {
      await asegurarSincronizado(q.id);
      await guardar();
      if (que === 'terminar') {
        await api(`/quotes/${q.id}/finalize`, { method: 'POST', body: {} });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await recargar();
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
    <View style={e.seccion}>
      <Texto variante="subtitulo">Presupuesto</Texto>

      {filas.map((f, n) => (
        <View key={f.clave} style={[e.item, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
          <Campo etiqueta={`Ítem ${n + 1}`} value={f.description} onChangeText={(v) => cambiar(f.clave, 'description', v)} placeholder="Qué vas a hacer o vender" maxLength={300} />
          <View style={e.fila}>
            <View style={e.mitad}><Campo etiqueta="Cantidad" value={f.quantity} onChangeText={(v) => cambiar(f.clave, 'quantity', v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" /></View>
            <View style={e.mitad}><Campo etiqueta="Precio unitario" value={f.unit_price} onChangeText={(v) => cambiar(f.clave, 'unit_price', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="$ 0" /></View>
          </View>
          <Chips etiqueta="Unidad" opciones={UNIDADES.map((u) => ({ id: u, texto: u === 'm2' ? 'm²' : u }))} valor={f.unit} alElegir={(u) => cambiar(f.clave, 'unit', u)} />
          <View style={e.fila}>
            <Texto fuerte style={e.monto}>{clp(Math.round(numero(f.quantity) * entero(f.unit_price)) || 0)}</Texto>
            <Boton titulo="Quitar" variante="texto" onPress={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))} />
          </View>
        </View>
      ))}
      <Boton titulo="+ Agregar ítem" variante="secundario" disabled={filas.length >= MAX_ITEMS} onPress={() => setFilas((fs) => [...fs, { clave: `n${++contador.current}`, description: '', quantity: '1', unit: 'un', unit_price: '' }])} />

      <Campo etiqueta="Descuento (opcional)" value={descuento} onChangeText={(v) => setDescuento(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="$ 0" />
      <Texto variante="chico" fuerte>Garantía</Texto>
      <Chips etiqueta="Garantía" opciones={GARANTIAS.map((g) => ({ id: g.kind, texto: g.texto }))} valor={garantia} alElegir={setGarantia} />
      <Campo etiqueta="Validez del presupuesto (días)" value={dias} onChangeText={(v) => setDias(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
      <Campo etiqueta="Observaciones (opcional)" value={obs} onChangeText={setObs} multiline maxLength={5000} placeholder="Condiciones, plazos, forma de pago…" />

      <View style={[e.total, { borderColor: t.borde }]}>
        <Texto>Total</Texto>
        <Texto variante="subtitulo" style={e.monto}>{clp(total)}</Texto>
      </View>

      {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
      <Boton titulo="Terminar presupuesto" onPress={pedirTerminar} cargando={trabajando === 'terminar'} disabled={trabajando !== null} />
      <Boton titulo="Guardar para después" variante="secundario" onPress={() => void correr('guardar')} cargando={trabajando === 'guardar'} disabled={trabajando !== null} />
    </View>
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
    <View style={e.seccion}>
      <Pastilla texto={enviado ? 'Enviado al cliente' : 'Listo para enviar'} tono={enviado ? 'ok' : 'aviso'} />
      <Texto variante="subtitulo">Enviar al cliente</Texto>
      <Texto suave>Tu cliente recibe el PDF y un enlace de solo lectura. No puede editar nada.</Texto>
      {q.public_url ? <Boton titulo="Compartir" onPress={() => void compartir()} /> : null}
      <Boton titulo="WhatsApp" variante="secundario" onPress={() => void whatsapp()} />
      {q.customer.email ? <Boton titulo="Enviar por correo" variante="secundario" onPress={correo} cargando={ocupado} disabled={ocupado} /> : <Texto variante="chico" suave>El cliente no tiene correo guardado.</Texto>}
      {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
    </View>
  );
}

const e = StyleSheet.create({
  seccion: { gap: espacio.l },
  item: { borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: espacio.l, gap: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  mitad: { flex: 1 },
  chips: { gap: espacio.s },
  chip: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 999, paddingHorizontal: espacio.l, alignItems: 'center', justifyContent: 'center' },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: espacio.m },
  monto: { fontVariant: ['tabular-nums'] },
});
