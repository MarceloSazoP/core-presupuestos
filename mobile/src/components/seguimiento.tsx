import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CampoModal } from '@/components/campo-modal';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Icono, Seccion, Tarjeta, Texto } from '@/components/ui';
import { ESTADOS } from '@/lib/estados';
import { aFechaLocal, diaCorto, enDias } from '@/lib/fechas';
import { pedirPermiso, sincronizarRecordatorios } from '@/lib/notificaciones';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Seguimiento comercial mínimo (CLAUDE.md §13): que no se olvide un presupuesto enviado. El estado se cambia desde las pestañas de
// la lista; aquí van el próximo contacto, las notas, llamar, WhatsApp y el historial.
const PLAZOS = [{ dias: 1, texto: 'Mañana' }, { dias: 3, texto: 'En 3 días' }, { dias: 7, texto: 'En 1 semana' }, { dias: 14, texto: 'En 2 semanas' }];
const NOMBRE = Object.fromEntries(ESTADOS.map((s) => [s.id, s.texto])); // para el historial

type Registro = { id: string; note: string | null; next_contact_date: string | null; commercial_status: string; created_at: string };

export function Seguimiento({ q, recargar }: { q: Presupuesto; recargar: () => Promise<void> }) {
  const t = useTema();
  const [historial, setHistorial] = useState<Registro[]>([]);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [calendario, setCalendario] = useState(false);
  const [elegida, setElegida] = useState(() => new Date(Date.now() + 86_400_000)); // por defecto, mañana
  const cerrada = q.commercial_status === 'ACCEPTED' || q.commercial_status === 'REJECTED';

  const cargarHistorial = useCallback(() => api<{ data: Registro[] }>(`/quotes/${q.id}/follow-ups`).then((r) => setHistorial(r.data)).catch(() => {}), [q.id]);
  useEffect(() => void cargarHistorial(), [cargarHistorial]);

  async function hacer(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await asegurarSincronizado(q.id);
      await accion();
      void Haptics.selectionAsync();
      await Promise.all([recargar(), cargarHistorial()]);
      void sincronizarRecordatorios(); // las fechas y los estados cambian qué avisos corresponden
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  }

  // `dia` es 'YYYY-MM-DD'. La notificación de ese día se programa a las 9:00.
  const programar = async (dia: string) => {
    await pedirPermiso(); // primera vez: el sistema pregunta; si lo rechazan, la fecha igual se guarda en la app
    setCalendario(false);
    return hacer(() => api(`/quotes/${q.id}/follow-ups`, { method: 'POST', body: { next_contact_date: dia, ...(nota.trim() ? { note: nota.trim() } : {}) } }).then(() => setNota('')));
  };
  // En iOS el calendario se muestra dentro de la pantalla; en Android es el diálogo del sistema.
  const abrirCalendario = () => {
    if (Platform.OS !== 'android') return setCalendario((v) => !v);
    DateTimePickerAndroid.open({ value: elegida, mode: 'date', minimumDate: new Date(), onChange: (ev, d) => { if (ev.type === 'set' && d) void programar(aFechaLocal(d)); } });
  };
  const soloNota = () => nota.trim() && hacer(() => api(`/quotes/${q.id}/follow-ups`, { method: 'POST', body: { note: nota.trim() } }).then(() => setNota('')));

  const conFecha = !!q.next_contact_date;
  return (
    <Seccion titulo="Seguimiento" icono="reloj" descripcion="Para que no se te olvide volver a llamar.">
      {cerrada ? null : (
        <Tarjeta>
          {/* Destacado: es lo que no hay que olvidar */}
          <View style={[e.proximo, { backgroundColor: conFecha ? `${t.seguimiento}1A` : t.campo, borderColor: conFecha ? t.seguimiento : t.borde }]}>
            <View style={e.rotulo}>
              <Icono nombre="calendario" tamano={16} color={conFecha ? t.seguimiento : t.suave} />
              <Texto variante="chico" fuerte color={conFecha ? 'seguimiento' : 'suave'}>Próximo contacto</Texto>
            </View>
            <Texto variante="titulo" color={conFecha ? 'seguimiento' : 'suave'}>{conFecha ? diaCorto(q.next_contact_date!) : 'Sin fecha'}</Texto>
            {conFecha ? <Texto variante="chico" suave>Ese día, a las 9:00, te llega un aviso en este teléfono.</Texto> : <Texto variante="chico" suave>Elige cuándo volver a contactar al cliente.</Texto>}
          </View>
          <View style={e.chips}>
            {PLAZOS.map((p) => {
              const elegido = q.next_contact_date === enDias(p.dias);
              return (
                <Pressable key={p.dias} accessibilityRole="button" accessibilityState={{ selected: elegido }} disabled={ocupado} onPress={() => void programar(enDias(p.dias))} style={({ pressed }) => [e.chip, { borderColor: elegido ? t.acento : t.bordeCampo, backgroundColor: elegido ? `${t.acento}1A` : t.campo, opacity: pressed ? 0.7 : 1 }]}>
                  <Texto color={elegido ? 'acento' : 'texto'} fuerte={elegido}>{p.texto}</Texto>
                </Pressable>
              );
            })}
          </View>
          {Platform.OS === 'web' ? null : <Boton titulo={calendario ? 'Cerrar calendario' : 'Elegir otra fecha'} icono="calendario" variante="secundario" disabled={ocupado} onPress={abrirCalendario} />}
          {calendario && Platform.OS === 'ios' ? (
            <View style={[e.calendario, { backgroundColor: t.campo, borderColor: t.borde }]}>
              <DateTimePicker value={elegida} mode="date" display="inline" minimumDate={new Date()} accentColor={t.acento} onChange={(_, d) => d && setElegida(d)} />
              <Boton titulo={`Programar para el ${diaCorto(aFechaLocal(elegida))}`} disabled={ocupado} onPress={() => void programar(aFechaLocal(elegida))} />
            </View>
          ) : null}
          {conFecha ? <Boton titulo="Quitar la fecha" variante="texto" disabled={ocupado} onPress={() => void hacer(() => api(`/quotes/${q.id}/next-contact`, { method: 'DELETE' }))} /> : null}
        </Tarjeta>
      )}

      <Tarjeta>
        <View style={e.fila}>
          <Boton titulo="Llamar" icono="llamar" variante="secundario" style={e.mitad} onPress={() => void Linking.openURL(`tel:${q.customer.phone}`)} />
          <Boton titulo="WhatsApp" icono="mensaje" variante="secundario" style={e.mitad} onPress={() => void Linking.openURL(`https://wa.me/${q.customer.phone.replace(/\D/g, '')}`)} />
        </View>
        <CampoModal etiqueta="Nota (opcional)" titulo="Nota" agregar="Agregar nota" valor={nota} alCambiar={setNota} maxLength={2000} placeholder="Qué te dijo, qué falta" />
        <Boton titulo="Guardar nota" variante="secundario" disabled={ocupado || !nota.trim()} onPress={() => void soloNota()} />
        {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
      </Tarjeta>

      {historial.length ? (
        <Tarjeta>
          <Texto variante="chico" fuerte>Historial</Texto>
          {/* Línea de tiempo: un punto por registro, unidos por una línea. */}
          {historial.map((h, i) => (
            <View key={h.id} style={e.registro}>
              <View style={e.riel}>
                <View style={[e.punto, { backgroundColor: t.seguimiento }]} />
                {i < historial.length - 1 ? <View style={[e.linea, { backgroundColor: t.borde }]} /> : null}
              </View>
              <View style={e.registroTexto}>
                <Texto variante="chico" suave>{diaCorto(h.created_at.slice(0, 10))} · {NOMBRE[h.commercial_status] ?? h.commercial_status}{h.next_contact_date ? ` · contactar ${diaCorto(h.next_contact_date)}` : ''}</Texto>
                {h.note ? <Texto>{h.note}</Texto> : null}
              </View>
            </View>
          ))}
        </Tarjeta>
      ) : null}
    </Seccion>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.l, alignItems: 'center', justifyContent: 'center' },
  mitad: { flex: 1 },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proximo: { borderWidth: 1.5, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.l, gap: espacio.xs },
  calendario: { borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.m, gap: espacio.m },
  registro: { flexDirection: 'row', gap: espacio.m },
  riel: { width: 10, alignItems: 'center' },
  punto: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  linea: { width: 2, flex: 1, marginTop: 4 },
  registroTexto: { flex: 1, gap: 2, paddingBottom: espacio.m },
});
