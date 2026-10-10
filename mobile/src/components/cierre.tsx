import * as Haptics from 'expo-haptics';
import { GARANTIAS, ModalCondiciones } from '@/components/modal-condiciones';
import { BotonOjo } from '@/components/boton-ojo';
import { delPresupuesto, useDinero } from '@/lib/montos';
import { BarraFlotante } from '@/components/barra-flotante';
import { montoDeDescuento, porcentajeDe } from '@/lib/descuento';
import { avisar } from '@/lib/toast';
import { simboloUnidad } from '@/lib/unidades';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { Button, Divider, Switch, Text, TouchableRipple } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { entero, ModalItem, numero, valorDe, type Fila } from '@/components/modal-item';
import { useDialogo } from '@/components/dialogo';
import { FilaVisita, GrupoVisita } from '@/components/fila-visita';
import { BotonM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { totalesDe } from '@/lib/totales';
import { tasaLegible } from '@/lib/paises';
import { AvisoSinSenal } from '@/components/sincronizacion';
import { borradorVigente, claveBorradorCierre } from '@/lib/borrador-cierre';
import { useSinSenal } from '@/lib/conexion';
import { aFechaLocal, diaCorto } from '@/lib/fechas';
import { huellaCierre } from '@/lib/huellas';
import { asegurarSincronizado } from '@/sync/cola';
import { guardarKv, leerKv } from '@/sync/db';
import { espacio, useTema } from '@/theme';

// Etapa 3 del wizard (CLAUDE.md §10): ítems, descuento, garantía y vigencia, y TERMINAR. Requiere conexión: los totales,
// el número y el PDF los calcula el servidor; aquí solo se captura y se muestra.
// Las duraciones: «sin garantía» es el interruptor apagado (kind NONE), no una opción más.
const MAX_ITEMS = 100;

export function Cierre({ q, recargar, alTerminar }: { q: Presupuesto; recargar: () => Promise<void>; alTerminar?: () => void }) {
  const t = useTema();
  const { dialogo, decidir } = useDialogo();
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
  const sinSenal = useSinSenal();

  // Lo que se arma aquí queda en el teléfono hasta guardarlo (sin señal, o si la app se cierra): al abrir se recupera si el presupuesto
  // no cambió en el servidor; no se escribe nada antes de haberlo leído, para no pisar el borrador con lo del servidor.
  const [base] = useState(() => huellaCierre(q));
  const borradorLeido = useRef(false);
  useEffect(() => {
    void leerKv(claveBorradorCierre(q.id)).then((v) => {
      const b = borradorVigente<Fila>(v, base);
      if (b) {
        setFilas(b.filas);
        setPct(b.pct);
        setConIva(b.conIva);
        setDias(b.dias);
        setGarantia(b.garantia);
        setObs(b.obs);
      }
      borradorLeido.current = true;
    });
  }, [q.id, base]);
  useEffect(() => {
    if (borradorLeido.current) void guardarKv(claveBorradorCierre(q.id), JSON.stringify({ base, filas, pct, conIva, dias, garantia, obs }));
  }, [q.id, base, filas, pct, conIva, dias, garantia, obs]);

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
  const tasaTexto = tasaLegible(tasa); // 11,5 en Puerto Rico
  const desc = pct === null ? q.discount : montoDeDescuento(subtotal, pct); // el servidor guarda el monto; aquí se elige en porcentaje
  const { iva, total } = totalesDe(subtotal, desc, conIva, tasa);
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
      await guardarKv(claveBorradorCierre(q.id), 'null'); // ya está en el servidor
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
    decidir('¿Terminar el presupuesto?', 'Se le asigna su número y se genera el PDF. Después ya no se puede editar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Terminar', onPress: () => void correr('terminar') },
    ]);

  const abrirCondiciones = () => setCondiciones(true);
  const conDesglose = `Subtotal ${clp(subtotal)}.${desc > 0 ? ` Descuento${pct ? ` ${pct} por ciento` : ''} ${clp(desc)}.` : ''}${conIva ? ` ${impuesto} ${tasaTexto} por ciento, ${clp(iva)}.` : ''}`;

  return (
    <>
      {/* Rediseño: arriba el total (grande, con su desglose en gris y el impuesto, que es lo que lo cambia); después «Lo que cobras» como
          lista, con «+ Ítem» y «+ Tarea» al pie de la tarjeta (botones de texto: ya no se confunden con Guardar y Terminar); y las
          condiciones a la vista, una fila cada una. */}
      <TarjetaM sinRelleno>
        <View accessible accessibilityLabel={`${detalle ? conDesglose : ''} Total ${clp(total)}.`} style={e.bloqueTotal}>
          <View style={e.filaDesglose}>
            <Text variant="labelLarge" style={{ color: t.suave }}>Total del presupuesto</Text>
            <BotonOjo clave={delPresupuesto(q.id)} color={t.suave} chico />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[e.monto, e.totalMonto, { color: t.texto }]}>{clp(total)}</Text>
          {detalle ? (
            <View style={e.desglose}>
              <View style={e.filaDesglose}>
                <Text variant="bodyMedium" style={{ color: t.suave }}>Subtotal</Text>
                <Text variant="bodyMedium" style={[e.monto, { color: t.suave }]}>{clp(subtotal)}</Text>
              </View>
              {desc > 0 ? (
                <View style={e.filaDesglose}>
                  <Text variant="bodyMedium" style={{ color: t.suave }}>{pct ? `Descuento ${pct} %` : 'Descuento'}</Text>
                  <Text variant="bodyMedium" style={[e.monto, { color: t.suave }]}>−{clp(desc)}</Text>
                </View>
              ) : null}
              {conIva ? (
                <View style={e.filaDesglose}>
                  <Text variant="bodyMedium" style={{ color: t.suave }}>{impuesto} {tasaTexto} %</Text>
                  <Text variant="bodyMedium" style={[e.monto, { color: t.suave }]}>{clp(iva)}</Text>
                </View>
              ) : null}
            </View>
          ) : filas.length === 0 ? (
            <Text variant="bodySmall" style={{ color: t.suave }}>Se calcula solo con lo que cobras.</Text>
          ) : null}
        </View>
        <Divider />
        <View style={e.filaIva}>
          <Text variant="bodyLarge" style={e.textoIva}>Agregar {impuesto} ({tasaTexto} %)</Text>
          <Switch accessibilityLabel={`Agregar ${impuesto} (${tasaTexto}%)`} value={conIva} onValueChange={(on) => { setConIva(on); avisar.info(on ? `${impuesto} agregado` : `${impuesto} quitado`, on ? `El total ahora lleva ${impuesto} (${tasaTexto} %).` : 'El total queda sin impuesto.'); }} color={t.acento} />
        </View>
      </TarjetaM>

      <GrupoVisita
        titulo="Lo que cobras"
        nota="Sale en el PDF"
        pie={
          <>
            <Button mode="text" icon={({ size, color }) => <Icono nombre="mas" tamano={size} color={color} />} textColor={t.acento} disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('item')} accessibilityLabel="Agregar ítem" style={e.botonPie} contentStyle={e.contenidoPie} labelStyle={e.textoPie}>
              Ítem
            </Button>
            <Button mode="text" icon={({ size, color }) => <Icono nombre="mas" tamano={size} color={color} />} textColor={t.acento} disabled={filas.length >= MAX_ITEMS} onPress={() => agregar('tarea')} accessibilityLabel="Agregar tarea" style={e.botonPie} contentStyle={e.contenidoPie} labelStyle={e.textoPie}>
              Tarea
            </Button>
          </>
        }
      >
        {filas.length ? (
          filas.map((f, n) => (
            <Animated.View key={f.clave} entering={f.clave === recien ? FadeIn.duration(180) : undefined}>
              <FilaCobro
                fila={f}
                numero={n + 1}
                detalle={f.tipo === 'tarea' ? 'Tarea' : `${String(f.quantity).replace('.', ',')} ${simboloUnidad(f.unit)} × ${clp(entero(f.unit_price))}`}
                monto={f.tipo === 'tarea' && !f.unit_price ? 'Incluido' : clp(valorDe(f))}
                alTocar={() => setAbierta({ fila: f, nueva: false })}
              />
            </Animated.View>
          ))
        ) : (
          <View style={e.vacio}>
            <Text variant="titleSmall">Aún no agregas nada</Text>
            <Text variant="bodySmall" style={[e.centrado, { color: t.suave }]}>Un ítem es lo que vendes, con cantidad y precio. Una tarea es algo que haces, como botar escombros.</Text>
          </View>
        )}
      </GrupoVisita>

      {/* Las condiciones a la vista, una fila cada una; todas abren la misma hoja. */}
      <GrupoVisita titulo="Condiciones" nota="Sale en el PDF">
        <FilaVisita icono="porcentaje" etiqueta="Descuento" valor={desc > 0 ? (pct ? `${pct} %` : `Descuento fijo ${clp(q.discount)}`) : 'Sin descuento'} alTocar={abrirCondiciones} />
        <FilaVisita icono="escudo" etiqueta="Garantía" valor={garantia === 'NONE' ? 'Sin garantía' : (GARANTIAS.find((g) => g.kind === garantia)?.texto ?? '')} alTocar={abrirCondiciones} />
        <FilaVisita icono="calendario" etiqueta="Validez" valor={`${dias || '—'} días`} alTocar={abrirCondiciones} />
        <FilaVisita icono="documento" etiqueta="Observaciones" valor={obs} vacio="Agregar plazos, forma de pago…" alTocar={abrirCondiciones} />
      </GrupoVisita>

      {/* Las acciones flotan al pie mientras queda formulario por ver y, al llegar al final, se quedan en su sitio sin tapar nada. */}
      <BarraFlotante reserva={RESERVA_BARRA} pista="Condiciones">
        {/* Sin señal se puede seguir armando (queda en el teléfono); guardar y terminar esperan a que vuelva la conexión. */}
        {sinSenal ? (
          <AvisoSinSenal texto="lo que escribes queda en el teléfono. Para guardar o terminar, necesitas internet." />
        ) : error ? (
          <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM>
        ) : null}
        <View style={e.fila}>
          <BotonM titulo="Guardar" icono="guardar" variante="secundario" onPress={() => void correr('guardar')} cargando={trabajando === 'guardar'} disabled={trabajando !== null || sinSenal} style={e.mitad} accessibilityLabel="Guardar y volver" />
          <BotonM titulo="Terminar presupuesto" icono="listo" onPress={pedirTerminar} cargando={trabajando === 'terminar'} disabled={trabajando !== null || sinSenal} style={e.mayor} />
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
      {dialogo}
    </>
  );
}

// Enviar un presupuesto terminado: compartir (hoja del sistema), WhatsApp o correo; cada uno lo marca como enviado. Lo usan la tarjeta de
// envío y la barra de abajo del presupuesto terminado. El PDF y el enlace público los generó el servidor al terminar.
export function useEnvio(q: Presupuesto, recargar: () => Promise<void>) {
  const { dialogo, decidir } = useDialogo();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function marcar(ruta: string, body: unknown = {}) {
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
    decidir(titulo, undefined, [{ text: 'No', style: 'cancel' }, { text: ok, onPress: alConfirmar }]);

  const mensaje = `Hola ${q.customer.name}, te comparto tu presupuesto ${q.number}. Puedes revisarlo y aceptarlo aquí: ${q.public_url}`;

  async function compartir() {
    const r = await Share.share({ message: mensaje });
    if (r.action === Share.sharedAction) await marcar('mark-sent', { channel: 'SHARE' });
  }

  async function whatsapp() {
    const tel = q.customer.phone.replace(/\D/g, '');
    try {
      await Linking.openURL(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`);
    } catch {
      return setError('No se pudo abrir WhatsApp.');
    }
    confirmar('¿Enviaste el mensaje?', 'Sí, enviado', () => void marcar('mark-sent', { channel: 'WHATSAPP' }));
  }

  // El servidor arma el correo según el estado (Contrato API §7): aquí solo cambia cómo se pregunta.
  const aceptado = q.commercial_status === 'ACCEPTED';
  const correo = () =>
    confirmar(aceptado ? `¿Enviar una copia a ${q.customer.email}?` : q.sent_at ? `¿Reenviar a ${q.customer.email}?` : `¿Enviar a ${q.customer.email}?`, aceptado ? 'Enviar copia' : 'Enviar', () => {
      setOcupado(true);
      void marcar('send-email').finally(() => setOcupado(false));
    });

  return { compartir, whatsapp, correo, error, ocupado, dialogo };
}

// Presupuesto terminado: la tarjeta para enviarlo, con el texto y los botones de su estado. Sin enviar: enviar por primera vez. Enviado
// o en seguimiento: reenviar (el correo sigue con el botón para aceptar). Aceptado: solo una copia por correo, que va con el PDF
// timbrado. Rechazado no la muestra: ahí va la versión nueva.
const ENVIO = {
  nuevo: { titulo: 'Enviar al cliente', correo: 'Enviar por correo', whatsapp: 'WhatsApp', texto: () => 'Le llega el presupuesto con un botón para aceptarlo. El PDF se lo enviamos cuando lo acepte.' },
  enviado: { titulo: 'Reenviar al cliente', correo: 'Reenviar por correo', whatsapp: 'Reenviar por WhatsApp', texto: (dia: string) => `Se lo enviaste el ${dia}. Si no lo encuentra, reenvíaselo: sigue con el botón para aceptarlo.` },
  aceptado: { titulo: 'Copia para el cliente', correo: 'Enviar copia a correo', whatsapp: null, texto: (dia: string) => `Tu cliente lo aceptó el ${dia}. Si necesita el PDF otra vez, envíale una copia: va con el timbre «Aceptado».` },
} as const;
const diaDe = (iso: string | null | undefined) => (iso ? diaCorto(aFechaLocal(new Date(iso))) : '');

export function Envio({ q, recargar }: { q: Presupuesto; recargar: () => Promise<void> }) {
  const { compartir, whatsapp, correo, error, ocupado, dialogo } = useEnvio(q, recargar);
  const sinSenal = useSinSenal();
  if (q.commercial_status === 'REJECTED') return null;
  const aceptado = q.commercial_status === 'ACCEPTED';
  const e = aceptado ? ENVIO.aceptado : q.commercial_status === 'NONE' ? ENVIO.nuevo : ENVIO.enviado;

  return (
    <TarjetaM>
      <TextoM variante="subtitulo" accessibilityRole="header">{e.titulo}</TextoM>
      <TextoM suave>{e.texto(diaDe(aceptado ? q.accepted_at : q.sent_at))}</TextoM>
      {q.public_url && !aceptado ? <BotonM titulo="Compartir" icono="compartir" onPress={() => void compartir()} disabled={sinSenal} /> : null}
      {e.whatsapp ? <BotonM titulo={e.whatsapp} icono="mensaje" variante="secundario" onPress={() => void whatsapp()} disabled={sinSenal} /> : null}
      {q.customer.email ? <BotonM titulo={e.correo} icono="correo" variante={aceptado ? 'primario' : 'secundario'} onPress={correo} cargando={ocupado} disabled={ocupado || sinSenal} /> : <TextoM variante="chico" suave>El cliente no tiene correo guardado.</TextoM>}
      {sinSenal ? (
        <AvisoSinSenal texto="para enviar el presupuesto, necesitas internet." />
      ) : error ? (
        <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM>
      ) : null}
      {dialogo}
    </TarjetaM>
  );
}

// Una fila de «Lo que cobras»: el ícono (caja para un ítem, lista para una tarea), la descripción, el detalle («4 un × $12.500») y el monto a
// la derecha. Tocarla abre su hoja.
function FilaCobro({ fila, numero, detalle, monto, alTocar }: { fila: Fila; numero: number; detalle: string; monto: string; alTocar: () => void }) {
  const t = useTema();
  const tarea = fila.tipo === 'tarea';
  const descripcion = fila.description.trim();
  return (
    <TouchableRipple accessibilityRole="button" accessibilityLabel={`${tarea ? 'Tarea' : 'Ítem'} ${numero}: ${descripcion || 'sin descripción'}, ${detalle}, ${monto}. Editar`} onPress={alTocar} style={e.filaCobro}>
      <View style={e.contenidoCobro}>
        <View style={e.iconoCobro}>
          <Icono nombre={tarea ? 'tarea' : 'caja'} tamano={22} color={t.suave} />
        </View>
        <View style={e.flex}>
          <Text variant="bodyLarge" numberOfLines={2} style={{ color: descripcion ? t.texto : t.suave }}>{descripcion || (tarea ? 'Tarea sin descripción' : 'Ítem sin descripción')}</Text>
          <Text variant="bodySmall" numberOfLines={1} style={[e.monto, { color: t.suave }]}>{detalle}</Text>
        </View>
        <Text variant="titleMedium" numberOfLines={1} style={[e.monto, e.fuerte, { color: monto === 'Incluido' ? t.suave : t.texto }]}>{monto}</Text>
      </View>
    </TouchableRipple>
  );
}

const RESERVA_BARRA = espacio.xxl * 2; // igual al paddingBottom del contenido de la pantalla del presupuesto
const e = StyleSheet.create({
  flex: { flex: 1 },
  bloqueTotal: { paddingTop: espacio.l, paddingHorizontal: espacio.l, paddingBottom: 14, gap: espacio.xs },
  filaDesglose: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  totalMonto: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  desglose: { gap: espacio.xs, marginTop: espacio.s },
  filaIva: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m, paddingHorizontal: espacio.l },
  textoIva: { flex: 1 },
  filaCobro: { paddingVertical: 14, paddingHorizontal: espacio.l },
  contenidoCobro: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  iconoCobro: { alignSelf: 'flex-start', paddingTop: 2 },
  vacio: { alignItems: 'center', gap: 6, paddingTop: espacio.xl, paddingBottom: espacio.m, paddingHorizontal: espacio.xl },
  botonPie: { borderRadius: 999 },
  contenidoPie: { minHeight: 44 },
  textoPie: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  mitad: { flex: 1 },
  mayor: { flex: 1.6 },
  monto: { fontVariant: ['tabular-nums'] },
  fuerte: { fontWeight: '600' },
  centrado: { textAlign: 'center' },
});
