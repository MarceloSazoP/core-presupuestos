import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { EstadoComercial, Presupuesto } from '@/api/types';
import { Boton, Campo, Texto } from '@/components/ui';
import { diaCorto, enDias } from '@/lib/fechas';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Seguimiento comercial mínimo (CLAUDE.md §13): que no se olvide un presupuesto enviado. Aceptar o rechazar es manual.
const ESTADOS = [
  { id: 'SENT', texto: 'Enviado' }, { id: 'FOLLOW_UP', texto: 'Seguimiento' }, { id: 'ACCEPTED', texto: 'Aceptado' }, { id: 'REJECTED', texto: 'Rechazado' },
] as const satisfies readonly { id: Exclude<EstadoComercial, 'NONE'>; texto: string }[];
const PLAZOS = [{ dias: 1, texto: 'Mañana' }, { dias: 3, texto: 'En 3 días' }, { dias: 7, texto: 'En 1 semana' }, { dias: 14, texto: 'En 2 semanas' }];
const NOMBRE = Object.fromEntries(ESTADOS.map((s) => [s.id, s.texto]));

type Registro = { id: string; note: string | null; next_contact_date: string | null; commercial_status: string; created_at: string };

export function Seguimiento({ q, recargar }: { q: Presupuesto; recargar: () => Promise<void> }) {
  const t = useTema();
  const [historial, setHistorial] = useState<Registro[]>([]);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cerrada = q.commercial_status === 'ACCEPTED' || q.commercial_status === 'REJECTED';

  const cargarHistorial = useCallback(() => api<{ data: Registro[] }>(`/quotes/${q.id}/follow-ups`).then((r) => setHistorial(r.data)).catch(() => {}), [q.id]);
  useEffect(() => void cargarHistorial(), [cargarHistorial]);

  async function hacer(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      void Haptics.selectionAsync();
      await Promise.all([recargar(), cargarHistorial()]);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  }

  const cambiarEstado = (status: string) => hacer(async () => { await api(`/quotes/${q.id}/commercial-status`, { method: 'PUT', body: { status, ...(nota.trim() ? { note: nota.trim() } : {}) } }); setNota(''); });
  const programar = (dias: number) => hacer(() => api(`/quotes/${q.id}/follow-ups`, { method: 'POST', body: { next_contact_date: enDias(dias), ...(nota.trim() ? { note: nota.trim() } : {}) } }).then(() => setNota('')));
  const soloNota = () => nota.trim() && hacer(() => api(`/quotes/${q.id}/follow-ups`, { method: 'POST', body: { note: nota.trim() } }).then(() => setNota('')));

  return (
    <View style={e.seccion}>
      <Texto variante="subtitulo">Seguimiento</Texto>

      <Texto variante="chico" fuerte>Estado</Texto>
      <View style={e.chips}>
        {ESTADOS.map((s) => {
          const elegido = s.id === q.commercial_status;
          return (
            <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ selected: elegido, disabled: ocupado }} disabled={ocupado || elegido} onPress={() => void cambiarEstado(s.id)} style={[e.chip, { borderColor: elegido ? t.acento : t.borde, backgroundColor: elegido ? t.acento : t.tarjeta }]}>
              <Texto color={elegido ? 'sobreAcento' : 'texto'} fuerte={elegido}>{s.texto}</Texto>
            </Pressable>
          );
        })}
      </View>

      {cerrada ? null : (
        <>
          <Texto variante="chico" fuerte>Próximo contacto{q.next_contact_date ? ` · ${diaCorto(q.next_contact_date)}` : ''}</Texto>
          <View style={e.chips}>
            {PLAZOS.map((p) => (
              <Pressable key={p.dias} accessibilityRole="button" disabled={ocupado} onPress={() => void programar(p.dias)} style={[e.chip, { borderColor: q.next_contact_date === enDias(p.dias) ? t.acento : t.borde, backgroundColor: t.tarjeta }]}>
                <Texto>{p.texto}</Texto>
              </Pressable>
            ))}
          </View>
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
  historial: { gap: espacio.s },
  registro: { borderLeftWidth: 2, paddingLeft: espacio.m, gap: espacio.xs },
});
