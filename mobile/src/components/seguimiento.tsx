import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Texto } from '@/components/ui';
import { ESTADOS } from '@/lib/estados';
import { aFechaLocal, diaCorto, enDias } from '@/lib/fechas';
import { pedirPermiso, sincronizarRecordatorios } from '@/lib/notificaciones';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

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

  return (
    <View style={e.seccion}>
      <Texto variante="subtitulo">Seguimiento</Texto>

      {cerrada ? null : (
        <>
          {/* Destacado con un recuadro: es lo que no hay que olvidar */}
          <View style={[e.proximo, { borderColor: q.next_contact_date ? t.seguimiento : t.borde, backgroundColor: q.next_contact_date ? `${t.seguimiento}1F` : t.tarjeta }]}>
            <Texto variante="chico" fuerte color={q.next_contact_date ? 'seguimiento' : 'suave'}>PRÓXIMO CONTACTO</Texto>
            <Texto variante="subtitulo" color={q.next_contact_date ? 'seguimiento' : 'suave'}>{q.next_contact_date ? diaCorto(q.next_contact_date) : 'Sin fecha programada'}</Texto>
            {q.next_contact_date ? <Texto variante="chico" suave>Ese día, a las 9:00, te llega un aviso en este teléfono.</Texto> : null}
          </View>
          <View style={e.chips}>
            {PLAZOS.map((p) => (
              <Pressable key={p.dias} accessibilityRole="button" disabled={ocupado} onPress={() => void programar(enDias(p.dias))} style={[e.chip, { borderColor: q.next_contact_date === enDias(p.dias) ? t.acento : t.borde, backgroundColor: t.tarjeta }]}>
                <Texto>{p.texto}</Texto>
              </Pressable>
            ))}
          </View>
          {Platform.OS === 'web' ? null : <Boton titulo={calendario ? 'Cerrar calendario' : 'Elegir otra fecha en el calendario'} variante="secundario" disabled={ocupado} onPress={abrirCalendario} />}
          {calendario && Platform.OS === 'ios' ? (
            <View style={[e.calendario, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
              <DateTimePicker value={elegida} mode="date" display="inline" minimumDate={new Date()} locale="es-CL" accentColor={t.acento} onChange={(_, d) => d && setElegida(d)} />
              <Boton titulo={`Programar para el ${diaCorto(aFechaLocal(elegida))}`} disabled={ocupado} onPress={() => void programar(aFechaLocal(elegida))} />
            </View>
          ) : null}
          {q.next_contact_date ? <Boton titulo="Quitar la fecha" variante="texto" disabled={ocupado} onPress={() => void hacer(() => api(`/quotes/${q.id}/next-contact`, { method: 'DELETE' }))} /> : null}
        </>
      )}

      <Campo etiqueta="Nota (opcional)" value={nota} onChangeText={setNota} multiline maxLength={2000} placeholder="Qué te dijo, qué falta" />
      <Boton titulo="Guardar nota" variante="secundario" disabled={ocupado || !nota.trim()} onPress={() => void soloNota()} />

      <View style={e.chips}>
        <Boton titulo="Llamar" variante="secundario" style={e.mitad} onPress={() => void Linking.openURL(`tel:${q.customer.phone}`)} />
        <Boton titulo="WhatsApp" variante="secundario" style={e.mitad} onPress={() => void Linking.openURL(`https://wa.me/${q.customer.phone.replace(/\D/g, '')}`)} />
      </View>
      {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}

      {historial.length ? (
        <View style={e.historial}>
          <Texto variante="chico" fuerte>Historial</Texto>
          {historial.map((h) => (
            <View key={h.id} style={[e.registro, { borderColor: t.borde }]}>
              <Texto variante="chico" suave>{diaCorto(h.created_at.slice(0, 10))} · {NOMBRE[h.commercial_status] ?? h.commercial_status}{h.next_contact_date ? ` · contactar ${diaCorto(h.next_contact_date)}` : ''}</Texto>
              {h.note ? <Texto>{h.note}</Texto> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const e = StyleSheet.create({
  seccion: { gap: espacio.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 999, paddingHorizontal: espacio.l, alignItems: 'center', justifyContent: 'center' },
  mitad: { flex: 1 },
  proximo: { borderWidth: 2, borderRadius: 14, borderCurve: 'continuous', padding: espacio.l, gap: espacio.xs },
  calendario: { borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: espacio.m, gap: espacio.m },
  historial: { gap: espacio.s },
  registro: { borderLeftWidth: 2, paddingLeft: espacio.m, gap: espacio.xs },
});
