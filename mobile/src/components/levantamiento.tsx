import { FlashList } from '@shopify/flash-list';
import { requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { fuenteDeArchivo, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Texto } from '@/components/ui';
import { prepararFoto } from '@/lib/foto';
import { guardarArchivo } from '@/sync/archivos';
import { descartarSubida, encolar } from '@/sync/cola';
import { espacio, letra, MIN_TOQUE, useTema } from '@/theme';

// Etapa 2 del wizard (CLAUDE.md §10): lo que se ve en terreno. Notas, medidas, fotos y voz. Todo es interno: nada de esto
// sale en el PDF. Funciona sin conexión: cada cambio se guarda en el teléfono y la cola de envío (sync/cola.ts) lo sube después.
const MAX_FOTOS = 30;
const MAX_VOCES = 5;
const MAX_MEDIDAS = 50;
const MAX_VOZ_SEGUNDOS = 300;

const sinPermiso = (que: string) =>
  Alert.alert(`Sin permiso para ${que}`, 'Actívalo en Ajustes para poder usarlo en la visita.', [
    { text: 'Ahora no', style: 'cancel' },
    { text: 'Abrir Ajustes', onPress: () => void Linking.openSettings() },
  ]);

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

type Cambiar = (f: (q: Presupuesto) => Presupuesto) => void; // actualiza la copia local del presupuesto
type Props = { q: Presupuesto; cambiar: Cambiar };
const conSurvey = (q: Presupuesto, s: Partial<Presupuesto['survey']>): Presupuesto => ({ ...q, survey: { ...q.survey, ...s } });

export function Levantamiento({ q, cambiar }: Props) {
  return (
    <View style={e.seccion}>
      <Texto variante="subtitulo">Visita en terreno</Texto>
      <Notas q={q} cambiar={cambiar} />
      <Medidas q={q} cambiar={cambiar} />
      <Fotos q={q} cambiar={cambiar} />
      <Voz q={q} cambiar={cambiar} />
    </View>
  );
}

// ── Notas ─────────────────────────────────────────────────────────────────────────────────────
function Notas({ q, cambiar }: Props) {
  const [notas, setNotas] = useState(q.survey.notes ?? '');
  const guardado = useRef(q.survey.notes ?? '');
  const [estado, setEstado] = useState<string | null>(null);

  async function guardar() {
    if (notas === guardado.current) return;
    try {
      cambiar((p) => conSurvey(p, { notes: notas.trim() || null }));
      await encolar({ quote_id: q.id, method: 'PUT', path: `/quotes/${q.id}/survey`, body: { notes: notas.trim() || null } });
      guardado.current = notas;
      setEstado('Guardado');
    } catch (err) {
      setEstado(mensajeDe(err));
    }
  }

  return (
    <Campo etiqueta="Notas" value={notas} onChangeText={(v) => { setNotas(v); setEstado(null); }} onBlur={guardar} multiline placeholder="Qué viste, qué pidió el cliente, lo que no puedes olvidar" error={estado && estado !== 'Guardado' ? estado : null} ayuda={estado === 'Guardado' ? 'Guardado' : 'Son internas: no salen en el PDF.'} />
  );
}

// ── Medidas ───────────────────────────────────────────────────────────────────────────────────
type FilaMedida = { clave: string; id: string; label: string; value: string }; // el id lo genera el teléfono: así el reintento no duplica

function Medidas({ q, cambiar }: Props) {
  const t = useTema();
  const [filas, setFilas] = useState<FilaMedida[]>(() => q.survey.measurements.map((m) => ({ clave: m.id, id: m.id, label: m.label, value: m.value })));
  const [error, setError] = useState<string | null>(null);

  // El servidor reemplaza la lista completa y su orden (PUT): se envían solo las filas completas.
  async function guardar(lista: FilaMedida[]) {
    const medidas = lista.filter((f) => f.label.trim() && f.value.trim()).map((f) => ({ id: f.id, label: f.label.trim(), value: f.value.trim() }));
    try {
      cambiar((p) => conSurvey(p, { measurements: medidas }));
      await encolar({ quote_id: q.id, method: 'PUT', path: `/quotes/${q.id}/measurements`, body: { measurements: medidas } });
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  const editarFila = (clave: string, campo: 'label' | 'value', v: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: v } : f)));
  const quitar = (clave: string) => {
    const resto = filas.filter((f) => f.clave !== clave);
    setFilas(resto);
    void guardar(resto);
  };

  return (
    <View style={e.bloque}>
      <Texto variante="chico" fuerte>Medidas</Texto>
      {filas.map((f) => (
        <View key={f.clave} style={e.filaMedida}>
          <TextInput accessibilityLabel="Qué mides" value={f.label} onChangeText={(v) => editarFila(f.clave, 'label', v)} onEndEditing={() => void guardar(filas)} placeholder="Largo" placeholderTextColor={t.suave} style={[e.entrada, e.etiquetaMedida, { color: t.texto, backgroundColor: t.tarjeta, borderColor: t.borde }]} />
          <TextInput accessibilityLabel="Cuánto mide" value={f.value} onChangeText={(v) => editarFila(f.clave, 'value', v)} onEndEditing={() => void guardar(filas)} placeholder="3,5 m" placeholderTextColor={t.suave} style={[e.entrada, e.valorMedida, { color: t.texto, backgroundColor: t.tarjeta, borderColor: t.borde }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar medida" onPress={() => quitar(f.clave)} hitSlop={4} style={e.quitar}>
            <Texto color="suave" variante="subtitulo">×</Texto>
          </Pressable>
        </View>
      ))}
      {error ? <Texto variante="chico" color="error" accessibilityRole="alert">{error}</Texto> : null}
      <Boton titulo="+ Agregar medida" variante="secundario" disabled={filas.length >= MAX_MEDIDAS} onPress={() => { const id = randomUUID(); setFilas((fs) => [...fs, { clave: id, id, label: '', value: '' }]); }} />
    </View>
  );
}

// ── Fotos ─────────────────────────────────────────────────────────────────────────────────────
function Fotos({ q, cambiar }: Props) {
  const t = useTema();
  const [preparando, setPreparando] = useState(0);
  const fotos = q.survey.photos;
  const quedan = MAX_FOTOS - fotos.length;

  async function agregar(origen: 'camara' | 'galeria') {
    if (quedan <= 0) return Alert.alert('Máximo de fotos', `Cada presupuesto admite hasta ${MAX_FOTOS} fotos.`);
    if (origen === 'camara') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return sinPermiso('usar la cámara');
    }
    const r = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: quedan });
    if (r.canceled) return;
    setPreparando((n) => n + r.assets.length);
    for (const a of r.assets) {
      try {
        const uri = guardarArchivo(await prepararFoto(a.uri, a.width, a.height), 'jpg');
        const id = randomUUID();
        cambiar((p) => conSurvey(p, { photos: [...p.survey.photos, { id, url: '', caption: null, local_uri: uri }] }));
        await encolar({ quote_id: q.id, method: 'POST', path: `/quotes/${q.id}/photos`, archivo: { uri, name: 'foto.jpg', type: 'image/jpeg' }, fields: { id } });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        Alert.alert('No se pudo guardar la foto', mensajeDe(err));
      } finally {
        setPreparando((n) => n - 1);
      }
    }
  }

  async function quitarFoto(id: string) {
    cambiar((p) => conSurvey(p, { photos: p.survey.photos.filter((f) => f.id !== id) }));
    if (!(await descartarSubida(q.id, id))) await encolar({ quote_id: q.id, method: 'DELETE', path: `/quotes/${q.id}/photos/${id}` });
  }

  const quitar = (id: string) =>
    Alert.alert('¿Quitar esta foto?', 'Se elimina del presupuesto.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void quitarFoto(id).catch((err) => Alert.alert('No se pudo quitar', mensajeDe(err))) },
    ]);

  return (
    <View style={e.bloque}>
      <Texto variante="chico" fuerte>Fotos ({fotos.length}/{MAX_FOTOS})</Texto>
      {fotos.length ? (
        <View style={e.tira}>
          <FlashList
            horizontal
            data={fotos}
            keyExtractor={(f) => f.id}
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={Espacio}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" accessibilityLabel="Foto de la visita. Toca para quitarla" onPress={() => quitar(item.id)}>
                <Image source={item.local_uri ? { uri: item.local_uri } : fuenteDeArchivo(item.url)} recyclingKey={item.id} contentFit="cover" transition={150} style={[e.miniatura, { backgroundColor: t.tarjeta, opacity: item.local_uri ? 0.6 : 1 }]} />
              </Pressable>
            )}
          />
        </View>
      ) : null}
      {preparando > 0 ? (
        <View style={e.subiendo}>
          <ActivityIndicator color={t.suave} />
          <Texto variante="chico" suave>Guardando {preparando} {preparando === 1 ? 'foto' : 'fotos'}…</Texto>
        </View>
      ) : null}
      <View style={e.fila}>
        <Boton titulo="Tomar foto" variante="secundario" onPress={() => void agregar('camara')} style={e.mitad} />
        <Boton titulo="Galería" variante="secundario" onPress={() => void agregar('galeria')} style={e.mitad} />
      </View>
    </View>
  );
}

const Espacio = () => <View style={{ width: espacio.s }} />;

// ── Voz ───────────────────────────────────────────────────────────────────────────────────────
function Voz({ q, cambiar }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); // .m4a (AAC) en iOS y Android
  const estado = useAudioRecorderState(recorder);
  const [guardando, setGuardando] = useState(false);
  const corte = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notas = q.survey.voice_notes;

  async function empezar() {
    if (notas.length >= MAX_VOCES) return Alert.alert('Máximo de notas', `Cada presupuesto admite hasta ${MAX_VOCES} notas de voz.`);
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) return sinPermiso('usar el micrófono');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    corte.current = setTimeout(() => void detener(), MAX_VOZ_SEGUNDOS * 1000); // el servidor admite hasta 5 minutos: se corta solo
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  async function detener() {
    clearTimeout(corte.current);
    const duracion = Math.min(MAX_VOZ_SEGUNDOS, Math.max(1, Math.ceil(recorder.currentTime)));
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) return;
    setGuardando(true);
    try {
      const local = guardarArchivo(uri, 'm4a');
      const id = randomUUID();
      cambiar((p) => conSurvey(p, { voice_notes: [...p.survey.voice_notes, { id, url: '', duration_seconds: duracion, local_uri: local }] }));
      await encolar({ quote_id: q.id, method: 'POST', path: `/quotes/${q.id}/voice-notes`, archivo: { uri: local, name: 'nota.m4a', type: 'audio/mp4' }, fields: { id, duration_seconds: String(duracion) } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('No se pudo guardar la nota de voz', mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  const segundos = estado.durationMillis / 1000;
  const grabando = estado.isRecording;
  useEffect(() => () => clearTimeout(corte.current), []); // al salir de la pantalla no queda un corte pendiente

  return (
    <View style={e.bloque}>
      <Texto variante="chico" fuerte>Notas de voz ({notas.length}/{MAX_VOCES})</Texto>
      {notas.map((n) => (
        <NotaDeVoz key={n.id} nota={n} alBorrar={async () => {
          cambiar((p) => conSurvey(p, { voice_notes: p.survey.voice_notes.filter((v) => v.id !== n.id) }));
          if (!(await descartarSubida(q.id, n.id))) await encolar({ quote_id: q.id, method: 'DELETE', path: `/quotes/${q.id}/voice-notes/${n.id}` });
        }} />
      ))}
      <Boton titulo={grabando ? `Detener · ${mmss(segundos)}` : 'Grabar nota de voz'} variante={grabando ? 'primario' : 'secundario'} cargando={guardando} onPress={() => void (grabando ? detener() : empezar())} />
    </View>
  );
}

function NotaDeVoz({ nota, alBorrar }: { nota: Presupuesto['survey']['voice_notes'][number]; alBorrar: () => Promise<void> }) {
  const t = useTema();
  const fuente = useMemo(() => (nota.local_uri ? { uri: nota.local_uri } : fuenteDeArchivo(nota.url)), [nota.url, nota.local_uri]); // estable: un objeto nuevo en cada render reiniciaría el reproductor
  const player = useAudioPlayer(fuente);
  const { playing } = useAudioPlayerStatus(player);

  async function alternar() {
    if (playing) return player.pause();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (player.duration > 0 && player.currentTime >= player.duration - 0.1) await player.seekTo(0);
    player.play();
  }

  const quitar = () =>
    Alert.alert('¿Quitar esta nota de voz?', 'Se elimina del presupuesto.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void alBorrar().catch((err) => Alert.alert('No se pudo quitar', mensajeDe(err))) },
    ]);

  return (
    <View style={[e.nota, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pausar nota de voz' : 'Escuchar nota de voz'} onPress={() => void alternar()} hitSlop={4} style={e.reproducir}>
        <Texto color="acento" fuerte>{playing ? 'Pausar' : 'Escuchar'}</Texto>
      </Pressable>
      <Texto suave style={e.duracion}>{mmss(nota.duration_seconds)}</Texto>
      <Pressable accessibilityRole="button" accessibilityLabel="Quitar nota de voz" onPress={quitar} hitSlop={4} style={e.quitar}>
        <Texto color="suave" variante="subtitulo">×</Texto>
      </Pressable>
    </View>
  );
}

const e = StyleSheet.create({
  seccion: { gap: espacio.xl },
  bloque: { gap: espacio.s },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  filaMedida: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  entrada: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: espacio.m, fontSize: letra.cuerpo },
  etiquetaMedida: { flex: 3 },
  valorMedida: { flex: 2 },
  quitar: { width: MIN_TOQUE, height: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' },
  tira: { height: 96 },
  miniatura: { width: 96, height: 96, borderRadius: 12, borderCurve: 'continuous' },
  subiendo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  nota: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingLeft: espacio.l, minHeight: MIN_TOQUE },
  reproducir: { flex: 1, minHeight: MIN_TOQUE, justifyContent: 'center' },
  duracion: { fontVariant: ['tabular-nums'] },
});
