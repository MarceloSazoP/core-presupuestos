import { FlashList } from '@shopify/flash-list';
import { DireccionMapa } from '@/components/direccion-mapa';
import { CampoModal } from '@/components/campo-modal';
import { avisar } from '@/lib/toast';
import { requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { fuenteDeArchivo, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { useDialogo, type Decidir } from '@/components/dialogo';
import { BotonM, NotaM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { Icono, Presionable, TECLADO_ID, type NombreIcono } from '@/components/ui';
import { prepararFoto } from '@/lib/foto';
import { guardarArchivo } from '@/sync/archivos';
import { descartarSubida, encolar } from '@/sync/cola';
import { espacio, letra, MIN_TOQUE, radio, useTema } from '@/theme';

// Etapa 2 del wizard (CLAUDE.md §10): lo que se ve en terreno. Notas, medidas, fotos y voz. Todo es interno: nada de esto
// sale en el PDF. Funciona sin conexión: cada cambio se guarda en el teléfono y la cola de envío (sync/cola.ts) lo sube después.
const MAX_FOTOS = 30;
const MAX_VOCES = 5;
const MAX_MEDIDAS = 50;
const MAX_VOZ_SEGUNDOS = 300;

const sinPermiso = (decidir: Decidir, que: string) =>
  decidir(`Sin permiso para ${que}`, 'Actívalo en Ajustes para poder usarlo en la visita.', [
    { text: 'Ahora no', style: 'cancel' },
    { text: 'Abrir Ajustes', onPress: () => void Linking.openSettings() },
  ]);

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

type Cambiar = (f: (q: Presupuesto) => Presupuesto) => void; // actualiza la copia local del presupuesto
type Props = { q: Presupuesto; cambiar: Cambiar };
const conSurvey = (q: Presupuesto, s: Partial<Presupuesto['survey']>): Presupuesto => ({ ...q, survey: { ...q.survey, ...s } });

export function Levantamiento({ q, cambiar }: Props) {
  return (
    <>
      <SeccionM titulo="El trabajo" icono="trabajo" descripcion="Sale en el PDF del cliente.">
        <TarjetaM>
          <Trabajo q={q} cambiar={cambiar} />
        </TarjetaM>
      </SeccionM>
      <NotaM titulo="De la visita" icono="ubicacion">
        <Notas q={q} cambiar={cambiar} />
        <Medidas q={q} cambiar={cambiar} />
        <Multimedia q={q} cambiar={cambiar} />
      </NotaM>
    </>
  );
}

// Fotos y notas de voz de la visita, en su propia ventana: en la nota solo queda una fila con lo que hay (cuántas fotos y notas de voz).
function Multimedia({ q, cambiar }: Props) {
  const t = useTema();
  const [abierta, setAbierta] = useState(false);
  const fotos = q.survey.photos.length;
  const voces = q.survey.voice_notes.length;
  const resumen = fotos + voces === 0 ? 'Todavía no agregas fotos ni notas de voz' : [fotos ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : null, voces ? `${voces} ${voces === 1 ? 'nota de voz' : 'notas de voz'}` : null].filter(Boolean).join(' · ');
  return (
    <View style={e.bloque}>
      <Rotulo icono="camara" texto="Fotos y notas de voz" />
      <Presionable accessibilityRole="button" accessibilityLabel={`Fotos y notas de voz: ${resumen}. Abrir`} onPress={() => setAbierta(true)} estilo={[e.filaMultimedia, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
        <TextoM style={e.flexMultimedia} suave={fotos + voces === 0}>{resumen}</TextoM>
        <Icono nombre="siguiente" tamano={14} color={t.suave} />
      </Presionable>
      {abierta ? (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAbierta(false)}>
          <View style={[e.hojaMultimedia, { backgroundColor: t.fondo }]}>
            <View style={e.barraMultimedia}>
              <View style={e.ladoMultimedia} />
              <TextoM fuerte accessibilityRole="header">Fotos y notas de voz</TextoM>
              <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={() => setAbierta(false)} hitSlop={8} style={[e.ladoMultimedia, e.derechaMultimedia]}>
                <TextoM color="acento" fuerte>Listo</TextoM>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={e.contenidoMultimedia}>
              <Fotos q={q} cambiar={cambiar} />
              <Voz q={q} cambiar={cambiar} />
              <BotonM titulo="Listo" icono="listo" onPress={() => setAbierta(false)} />
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

// Rótulo de cada parte de la nota: un ícono y el nombre, con la cuenta cuando hay un máximo.
function Rotulo({ icono, texto }: { icono: NombreIcono; texto: string }) {
  const t = useTema();
  return (
    <View style={e.rotulo}>
      <Icono nombre={icono} tamano={16} color={t.notaSello} />
      <TextoM variante="chico" fuerte>{texto}</TextoM>
    </View>
  );
}

// ── Trabajo: descripción y dirección ──────────────────────────────────────────────────────────
// Se pueden completar o corregir en cualquier momento mientras el presupuesto está pendiente. Salen en el PDF. Sin conexión
// se guardan en el teléfono y viajan por la cola; PATCH sobre la misma ruta reemplaza al pendiente.
function Trabajo({ q, cambiar }: Props) {
  const [servicio, setServicio] = useState(q.service_description);
  const [direccion, setDireccion] = useState(q.address ?? '');
  const [punto, setPunto] = useState({ latitude: q.latitude ?? null, longitude: q.longitude ?? null });
  const clave = (p: { latitude: number | null; longitude: number | null }) => `${p.latitude},${p.longitude}`;
  const guardado = useRef({ servicio: q.service_description, direccion: q.address ?? '', punto: clave({ latitude: q.latitude ?? null, longitude: q.longitude ?? null }) });
  const [error, setError] = useState<string | null>(null);

  async function guardar(servicio: string, direccion: string, punto: { latitude: number | null; longitude: number | null }) {
    if (servicio === guardado.current.servicio && direccion === guardado.current.direccion && clave(punto) === guardado.current.punto) return;
    // Latitud y longitud van juntas o ninguna (Contrato API §6): el punto viaja siempre con la dirección.
    const cuerpo = { service_description: servicio.trim() || null, address: direccion.trim() || null, latitude: punto.latitude, longitude: punto.longitude };
    try {
      cambiar((p) => ({ ...p, service_description: servicio.trim(), address: cuerpo.address, latitude: punto.latitude, longitude: punto.longitude }));
      await encolar({ quote_id: q.id, method: 'PATCH', path: `/quotes/${q.id}`, body: cuerpo });
      guardado.current = { servicio, direccion, punto: clave(punto) };
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  return (
    <View style={e.bloque}>
      <CampoModal etiqueta="Servicio" titulo="Servicio" agregar="Agregar servicio" icono="trabajo" maxPalabras={69} valor={servicio} alCambiar={(v) => { setServicio(v); void guardar(v, direccion, punto); }} maxLength={2000} placeholder="Por ejemplo: instalar puerta" ayuda="Es obligatorio para terminar el presupuesto." error={error} />
      <DireccionMapa etiqueta="Dirección del trabajo (opcional)" direccion={direccion} latitude={punto.latitude} longitude={punto.longitude} alCambiar={(d) => { setDireccion(d.direccion); setPunto({ latitude: d.latitude, longitude: d.longitude }); void guardar(servicio, d.direccion, { latitude: d.latitude, longitude: d.longitude }); }} />
    </View>
  );
}

// ── Notas ─────────────────────────────────────────────────────────────────────────────────────
function Notas({ q, cambiar }: Props) {
  const [notas, setNotas] = useState(q.survey.notes ?? '');
  const guardado = useRef(q.survey.notes ?? '');
  const [estado, setEstado] = useState<string | null>(null);

  async function guardar(notas: string) {
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
    <CampoModal etiqueta="Notas" titulo="Notas" agregar="Agregar nota" icono="lapiz" valor={notas} alCambiar={(v) => { setNotas(v); setEstado(null); void guardar(v); }} placeholder="Qué viste, qué pidió el cliente, lo que no puedes olvidar" error={estado && estado !== 'Guardado' ? estado : null} ayuda={estado === 'Guardado' ? 'Guardado' : undefined} />
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
      <Rotulo icono="regla" texto="Medidas" />
      {filas.map((f) => (
        <View key={f.clave} style={e.filaMedida}>
          <TextInput inputAccessoryViewID={TECLADO_ID} accessibilityLabel="Qué mides" value={f.label} onChangeText={(v) => editarFila(f.clave, 'label', v)} onEndEditing={() => void guardar(filas)} placeholder="Ej: Largo" placeholderTextColor={t.suave} style={[e.entrada, e.etiquetaMedida, { color: t.texto, backgroundColor: t.tarjeta, borderColor: t.bordeCampo }]} />
          <TextInput inputAccessoryViewID={TECLADO_ID} accessibilityLabel="Cuánto mide" keyboardType="decimal-pad" value={f.value} onChangeText={(v) => editarFila(f.clave, 'value', v.replace(/[^\d.,]/g, ''))} onEndEditing={() => void guardar(filas)} placeholder="Ej: 3,5" placeholderTextColor={t.suave} style={[e.entrada, e.valorMedida, { color: t.texto, backgroundColor: t.tarjeta, borderColor: t.bordeCampo }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar medida" onPress={() => quitar(f.clave)} hitSlop={4} style={({ pressed }) => [e.quitar, { opacity: pressed ? 0.5 : 1 }]}>
            <Icono nombre="cerrar" tamano={18} color={t.suave} />
          </Pressable>
        </View>
      ))}
      {error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM> : null}
      <BotonM titulo="Agregar medida" icono="mas" variante="secundario" disabled={filas.length >= MAX_MEDIDAS} onPress={() => { const id = randomUUID(); setFilas((fs) => [...fs, { clave: id, id, label: '', value: '' }]); }} />
    </View>
  );
}

// ── Fotos ─────────────────────────────────────────────────────────────────────────────────────
function Fotos({ q, cambiar }: Props) {
  const t = useTema();
  const { dialogo, decidir } = useDialogo();
  const [preparando, setPreparando] = useState(0);
  const fotos = q.survey.photos;
  const quedan = MAX_FOTOS - fotos.length;

  async function agregar(origen: 'camara' | 'galeria') {
    Keyboard.dismiss(); // con el teclado abierto, el selector deja el espacio de abajo mal calculado
    if (quedan <= 0) return avisar.aviso('Máximo de fotos', `Cada presupuesto admite hasta ${MAX_FOTOS} fotos.`);
    if (origen === 'camara') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return sinPermiso(decidir, 'usar la cámara');
    }
    const r = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: quedan });
    if (r.canceled) return;
    setPreparando((n) => n + r.assets.length);
    for (const a of r.assets) {
      try {
        const uri = await guardarArchivo(await prepararFoto(a.uri, a.width, a.height));
        const id = randomUUID();
        cambiar((p) => conSurvey(p, { photos: [...p.survey.photos, { id, url: '', caption: null, local_uri: uri }] }));
        await encolar({ quote_id: q.id, method: 'POST', path: `/quotes/${q.id}/photos`, archivo: { uri, name: 'foto.jpg', type: 'image/jpeg' }, fields: { id } });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        avisar.error('No se pudo guardar la foto', mensajeDe(err));
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
    decidir('¿Quitar esta foto?', 'Se elimina del presupuesto.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void quitarFoto(id).catch((err) => avisar.error('No se pudo quitar', mensajeDe(err))) },
    ]);

  return (
    <View style={e.bloque}>
      <Rotulo icono="camara" texto={`Fotos (${fotos.length}/${MAX_FOTOS})`} />
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
          <TextoM variante="chico" suave>Guardando {preparando} {preparando === 1 ? 'foto' : 'fotos'}…</TextoM>
        </View>
      ) : null}
      <View style={e.fila}>
        <BotonM titulo="Tomar foto" icono="camara" variante="secundario" onPress={() => void agregar('camara')} style={e.mitad} />
        <BotonM titulo="Galería" icono="galeria" variante="secundario" onPress={() => void agregar('galeria')} style={e.mitad} />
      </View>
      {dialogo}
    </View>
  );
}

const Espacio = () => <View style={{ width: espacio.s }} />;

// ── Voz ───────────────────────────────────────────────────────────────────────────────────────
function Voz({ q, cambiar }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); // .m4a (AAC) en iOS y Android
  const { dialogo, decidir } = useDialogo();
  const estado = useAudioRecorderState(recorder);
  const [guardando, setGuardando] = useState(false);
  const corte = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notas = q.survey.voice_notes;

  async function empezar() {
    if (notas.length >= MAX_VOCES) return avisar.aviso('Máximo de notas', `Cada presupuesto admite hasta ${MAX_VOCES} notas de voz.`);
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) return sinPermiso(decidir, 'usar el micrófono');
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
      const local = await guardarArchivo(uri);
      const id = randomUUID();
      cambiar((p) => conSurvey(p, { voice_notes: [...p.survey.voice_notes, { id, url: '', duration_seconds: duracion, local_uri: local }] }));
      await encolar({ quote_id: q.id, method: 'POST', path: `/quotes/${q.id}/voice-notes`, archivo: { uri: local, name: 'nota.m4a', type: 'audio/mp4' }, fields: { id, duration_seconds: String(duracion) } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      avisar.error('No se pudo guardar la nota de voz', mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  const segundos = estado.durationMillis / 1000;
  const grabando = estado.isRecording;
  useEffect(() => () => clearTimeout(corte.current), []); // al salir de la pantalla no queda un corte pendiente

  return (
    <View style={e.bloque}>
      <Rotulo icono="microfono" texto={`Notas de voz (${notas.length}/${MAX_VOCES})`} />
      {notas.map((n) => (
        <NotaDeVoz key={n.id} nota={n} alBorrar={async () => {
          cambiar((p) => conSurvey(p, { voice_notes: p.survey.voice_notes.filter((v) => v.id !== n.id) }));
          if (!(await descartarSubida(q.id, n.id))) await encolar({ quote_id: q.id, method: 'DELETE', path: `/quotes/${q.id}/voice-notes/${n.id}` });
        }} />
      ))}
      <BotonM titulo={grabando ? `Detener · ${mmss(segundos)}` : 'Grabar nota de voz'} icono={grabando ? 'detener' : 'microfono'} variante={grabando ? 'primario' : 'secundario'} cargando={guardando} onPress={() => void (grabando ? detener() : empezar())} />
      {dialogo}
    </View>
  );
}

function NotaDeVoz({ nota, alBorrar }: { nota: Presupuesto['survey']['voice_notes'][number]; alBorrar: () => Promise<void> }) {
  const t = useTema();
  const { dialogo, decidir } = useDialogo();
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
    decidir('¿Quitar esta nota de voz?', 'Se elimina del presupuesto.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void alBorrar().catch((err) => avisar.error('No se pudo quitar', mensajeDe(err))) },
    ]);

  return (
    <View style={[e.nota, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pausar nota de voz' : 'Escuchar nota de voz'} onPress={() => void alternar()} hitSlop={4} style={({ pressed }) => [e.reproducir, { opacity: pressed ? 0.6 : 1 }]}>
        <View style={[e.botonPlay, { backgroundColor: t.acento }]}>
          <Icono nombre={playing ? 'pausar' : 'reproducir'} tamano={16} color={t.sobreAcento} />
        </View>
        <TextoM fuerte>{playing ? 'Reproduciendo' : 'Nota de voz'}</TextoM>
      </Pressable>
      <TextoM suave style={e.duracion}>{mmss(nota.duration_seconds)}</TextoM>
      <Pressable accessibilityRole="button" accessibilityLabel="Quitar nota de voz" onPress={quitar} hitSlop={4} style={({ pressed }) => [e.quitar, { opacity: pressed ? 0.5 : 1 }]}>
        <Icono nombre="cerrar" tamano={18} color={t.suave} />
      </Pressable>
      {dialogo}
    </View>
  );
}

const e = StyleSheet.create({
  filaMultimedia: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', paddingHorizontal: espacio.m },
  flexMultimedia: { flex: 1 },
  hojaMultimedia: { flex: 1 },
  barraMultimedia: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  ladoMultimedia: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  derechaMultimedia: { alignItems: 'flex-end' },
  contenidoMultimedia: { padding: espacio.xl, gap: espacio.xl, paddingBottom: espacio.xxl },
  bloque: { gap: espacio.s },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  filaMedida: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  entrada: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: espacio.m, fontSize: letra.cuerpo },
  etiquetaMedida: { flex: 3 },
  valorMedida: { flex: 2 },
  quitar: { width: MIN_TOQUE, height: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' },
  tira: { height: 96 },
  miniatura: { width: 96, height: 96, borderRadius: radio.m, borderCurve: 'continuous' },
  subiendo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  nota: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', paddingLeft: espacio.s, minHeight: 56 },
  reproducir: { flex: 1, minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  botonPlay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  duracion: { fontVariant: ['tabular-nums'] },
});
