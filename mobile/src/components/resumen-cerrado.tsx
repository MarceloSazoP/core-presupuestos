import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import { Text } from 'react-native-paper';
import type { Presupuesto } from '@/api/types';
import { BarraFlotante } from '@/components/barra-flotante';
import { BotonOjo } from '@/components/boton-ojo';
import { useEnvio } from '@/components/cierre';
import { BotonM, PastillaM, TarjetaM, TextoM } from '@/components/material';
import { MiniaturasFotos } from '@/components/multimedia';
import { AvisoSinSenal } from '@/components/sincronizacion';
import { Icono, type NombreIcono } from '@/components/ui';
import { useSinSenal } from '@/lib/conexion';
import { ESTADOS } from '@/lib/estados';
import { aFechaLocal, diaCorto, vencimiento } from '@/lib/fechas';
import { delPresupuesto, useDinero } from '@/lib/montos';
import { tasaLegible } from '@/lib/paises';
import { abrirPdf } from '@/lib/pdf';
import { avisar } from '@/lib/toast';
import { espacio, type Color, useTema } from '@/theme';

// Presupuesto terminado, al estilo del detalle de Invoice Ninja: lo primero que se ve es en qué va y cuánto es (en todas las pestañas),
// y las dos acciones de siempre quedan abajo, al alcance del pulgar.

const LISTO_PARA_ENVIAR = { texto: 'Listo para enviar', tono: 'aviso' } as const;

// Arriba: el estado, el total grande y las fechas que importan (cuándo se envió, hasta cuándo vale y el próximo contacto).
export function ResumenCerrado({ q }: { q: Presupuesto }) {
  const t = useTema();
  const montoDe = useDinero(delPresupuesto(q.id));
  const estado = ESTADOS.find((s) => s.id === q.commercial_status) ?? LISTO_PARA_ENVIAR;
  const abierto = q.commercial_status !== 'ACCEPTED' && q.commercial_status !== 'REJECTED'; // aún espera respuesta
  const desde = q.sent_at ?? q.finalized_at;
  const vence = q.finalized_at && q.validity_days ? vencimiento(q.finalized_at, q.validity_days) : null;
  const vencido = !!vence?.vencido && abierto;
  const total = montoDe(q.total, q.currency);
  const impuesto = q.include_vat ? `Incluye ${q.vat_label ?? 'IVA'} (${tasaLegible(q.vat_rate ?? 19)} %)` : null;
  return (
    <TarjetaM>
      <View style={e.cabecera}>
        <PastillaM texto={estado.texto} tono={estado.tono} />
        <BotonOjo clave={delPresupuesto(q.id)} color={t.suave} chico />
      </View>
      <View accessible accessibilityLabel={`Total ${total}.${impuesto ? ` ${impuesto}.` : ''}`} style={e.total}>
        <Text variant="labelLarge" style={{ color: t.suave }}>Total</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[e.monto, e.montoGrande, { color: t.texto }]}>{total}</Text>
        {impuesto ? <TextoM variante="chico" suave>{impuesto}</TextoM> : null}
      </View>
      <View style={[e.datos, { borderTopColor: t.borde }]}>
        {desde ? <Dato etiqueta={q.sent_at ? 'Enviado' : 'Terminado'} valor={diaCorto(aFechaLocal(new Date(desde)))} /> : null}
        {vence ? <Dato etiqueta={vencido ? 'Venció' : 'Vale hasta'} valor={diaCorto(vence.fecha)} color={vencido ? 'error' : undefined} /> : null}
        {abierto && q.next_contact_date ? <Dato etiqueta="Próximo contacto" valor={diaCorto(q.next_contact_date)} color="seguimiento" /> : null}
      </View>
    </TarjetaM>
  );
}

function Dato({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: Color }) {
  return (
    <View style={e.dato}>
      <TextoM variante="chico" suave>{etiqueta}</TextoM>
      <TextoM fuerte color={color}>{valor}</TextoM>
    </View>
  );
}

// Lo que se vio en terreno, de solo lectura: al hacer seguimiento hay que poder recordar la visita (no sale en el PDF).
export function VisitaLectura({ q }: { q: Presupuesto }) {
  const { notes, measurements, photos, voice_notes: voces } = q.survey;
  if (!notes?.trim() && !measurements.length && !photos.length && !voces.length) return null;
  const segundos = voces.reduce((s, v) => s + v.duration_seconds, 0);
  return (
    <TarjetaM>
      <TextoM variante="subtitulo" accessibilityRole="header">De la visita</TextoM>
      <TextoM variante="chico" suave>Solo para ti: no sale en el PDF.</TextoM>
      {notes?.trim() ? (
        <Bloque icono="lapiz" etiqueta="Notas">
          <TextoM selectable>{notes.trim()}</TextoM>
        </Bloque>
      ) : null}
      {measurements.length ? (
        <Bloque icono="regla" etiqueta="Medidas">
          {measurements.map((m) => (
            <TextoM key={m.id} style={e.monto}>{m.label}: {m.value}</TextoM>
          ))}
        </Bloque>
      ) : null}
      {photos.length ? (
        <Bloque icono="camara" etiqueta={photos.length === 1 ? '1 foto' : `${photos.length} fotos`}>
          <MiniaturasFotos fotos={photos} />
        </Bloque>
      ) : null}
      {voces.length ? (
        <Bloque icono="microfono" etiqueta="Notas de voz">
          <TextoM>{voces.length === 1 ? '1 nota' : `${voces.length} notas`} · {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')} en total</TextoM>
        </Bloque>
      ) : null}
    </TarjetaM>
  );
}

function Bloque({ icono, etiqueta, children }: { icono: NombreIcono; etiqueta: string; children: ReactNode }) {
  const t = useTema();
  return (
    <View style={e.bloque}>
      <View style={e.icono}>
        <Icono nombre={icono} tamano={20} color={t.suave} />
      </View>
      <View style={e.textos}>
        <TextoM variante="chico" suave fuerte>{etiqueta}</TextoM>
        {children}
      </View>
    </View>
  );
}

// Abajo, al alcance del pulgar: ver el PDF tal como lo recibe el cliente y la acción que toca ahora (compartirlo si aún no se envía;
// llamar al cliente si ya se envió). Sin señal, llamar sigue funcionando. `conCompartir`: falso en la pestaña «Enviar», que ya lo tiene
// (dos «Compartir» a la vista confunden).
export function AccionesCerrado({ q, recargar, reserva, conCompartir }: { q: Presupuesto; recargar: () => Promise<void>; reserva: number; conCompartir: boolean }) {
  const sinSenal = useSinSenal();
  const { compartir, error, dialogo } = useEnvio(q, recargar);
  const sinEnviar = q.commercial_status === 'NONE';
  const segundo = sinEnviar ? (conCompartir ? 'compartir' : null) : 'llamar';
  // El PDF real, descargado con la sesión (no el enlace web: en desarrollo apunta a una dirección que el teléfono no alcanza).
  const [abriendo, setAbriendo] = useState(false);
  const verPdf = () => {
    setAbriendo(true);
    abrirPdf(q)
      .catch((err) => avisar.error('No se pudo abrir el PDF', mensajeDe(err)))
      .finally(() => setAbriendo(false));
  };
  return (
    <BarraFlotante reserva={reserva}>
      {sinSenal ? (
        <AvisoSinSenal texto={sinEnviar ? 'para ver el PDF o compartirlo, necesitas internet.' : 'para ver el PDF, necesitas internet. Llamar sí funciona.'} />
      ) : error ? (
        <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM>
      ) : null}
      <View style={e.fila}>
        {q.public_url ? <BotonM titulo="Ver PDF" icono="documento" variante="secundario" onPress={verPdf} cargando={abriendo} disabled={sinSenal || abriendo} style={e.mitad} accessibilityLabel="Ver el PDF del presupuesto" /> : null}
        {segundo === 'compartir' ? (
          <BotonM titulo="Compartir" icono="compartir" onPress={() => void compartir()} disabled={sinSenal || !q.public_url} style={e.mayor} />
        ) : segundo === 'llamar' ? (
          <BotonM titulo="Llamar" icono="llamar" onPress={() => void Linking.openURL(`tel:${q.customer.phone}`)} style={e.mayor} accessibilityLabel={`Llamar a ${q.customer.name}`} />
        ) : null}
      </View>
      {dialogo}
    </BarraFlotante>
  );
}

const e = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  total: { gap: espacio.xs },
  monto: { fontVariant: ['tabular-nums'] },
  montoGrande: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.xl, rowGap: espacio.m, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espacio.m },
  dato: { gap: 2, minWidth: 96 },
  bloque: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.l },
  icono: { paddingTop: 2 },
  textos: { flex: 1, gap: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  mitad: { flex: 1 },
  mayor: { flex: 1.6 },
});
