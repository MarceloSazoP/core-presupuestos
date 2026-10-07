import { requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Fragment, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Divider, Text, TouchableRipple } from 'react-native-paper';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fuenteDeArchivo, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { useDialogo, type Decidir } from '@/components/dialogo';
import { BotonM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { prepararFoto } from '@/lib/foto';
import { avisar } from '@/lib/toast';
import { guardarArchivo } from '@/sync/archivos';
import { descartarSubida, encolar } from '@/sync/cola';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Fotos y notas de voz de la visita (CLAUDE.md §10, etapa 2). Son solo del profesional: no salen en el PDF. Funcionan sin conexión: cada
// una se guarda en el teléfono y la cola de envío (sync/cola.ts) la sube después.
//
// En la pantalla Visita, «Foto» abre la cámara al tiro (`useFotos`) y «Voz» abre su hoja grabando (`HojaVoz` con `grabarAlAbrir`); las
// filas de Fotos y Notas de voz abren su hoja para ver y quitar. Las fotos van en una cuadrícula: tocar una la abre en grande (se pasa a
// las demás deslizando) y cada una tiene su ✕ para quitarla. Las notas de voz se graban con un botón redondo grande; mientras graba, un
// punto rojo late junto al tiempo. Si se cierra la hoja mientras graba, la nota se guarda antes de cerrar.
const MAX_FOTOS = 30;
const MAX_VOCES = 5;
const MAX_VOZ_SEGUNDOS = 300;
const MINIATURAS = 4; // cuántas fotos se ven en la fila de la visita
const COLUMNAS = 3;
const ESPACIO_GRILLA = espacio.s;

type Cambiar = (f: (q: Presupuesto) => Presupuesto) => void; // actualiza la copia local del presupuesto
type Props = { q: Presupuesto; cambiar: Cambiar };
type Foto = Presupuesto['survey']['photos'][number];
type ControlVoz = { grabando: () => boolean; detener: () => Promise<void> };

const conSurvey = (q: Presupuesto, s: Partial<Presupuesto['survey']>): Presupuesto => ({ ...q, survey: { ...q.survey, ...s } });
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fuenteDe = (f: Foto) => (f.local_uri ? { uri: f.local_uri } : fuenteDeArchivo(f.url));
const sinPermiso = (decidir: Decidir, que: string) =>
  decidir(`Sin permiso para ${que}`, 'Actívalo en Ajustes para poder usarlo en la visita.', [
    { text: 'Ahora no', style: 'cancel' },
    { text: 'Abrir Ajustes', onPress: () => void Linking.openSettings() },
  ]);

// Agregar y quitar fotos: lo usan la hoja de Fotos y el botón «Foto» de la visita. `dialogo` va en el JSX de quien lo usa (los permisos
// y la confirmación de quitar se preguntan ahí).
export function useFotos(q: Presupuesto, cambiar: Cambiar) {
  const { dialogo, decidir } = useDialogo();
  const [preparando, setPreparando] = useState(0);
  const quedan = MAX_FOTOS - q.survey.photos.length;

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

  return { agregar, quitar, quitarFoto, preparando, quedan, dialogo };
}

// Las primeras fotos en miniatura (y «+N» si hay más), para la fila de Fotos de la visita.
export function MiniaturasFotos({ fotos }: { fotos: Foto[] }) {
  const t = useTema();
  const resto = fotos.length - MINIATURAS;
  return (
    <View style={e.miniaturas}>
      {fotos.slice(0, MINIATURAS).map((f) => (
        <Image key={f.id} source={fuenteDe(f)} recyclingKey={f.id} contentFit="cover" style={[e.miniatura, { backgroundColor: t.campo }]} />
      ))}
      {resto > 0 ? (
        <View style={[e.miniatura, e.mas, { backgroundColor: `${t.acento}1F` }]}>
          <Text variant="labelLarge" style={{ color: t.acento }}>+{resto}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Fotos ─────────────────────────────────────────────────────────────────────────────────────
export function HojaFotos({ q, cambiar, alCerrar }: Props & { alCerrar: () => void }) {
  const t = useTema();
  const { agregar, quitar, quitarFoto, preparando, quedan, dialogo } = useFotos(q, cambiar);
  const [ancho, setAncho] = useState(0);
  const [viendo, setViendo] = useState<number | null>(null); // la foto abierta en grande
  const fotos = q.survey.photos;
  const lado = ancho > 0 ? (ancho - ESPACIO_GRILLA * (COLUMNAS - 1)) / COLUMNAS : 0;

  return (
    <HojaM titulo="Fotos" listo={{ titulo: 'Listo', fuerte: true, onPress: alCerrar }} alCerrar={alCerrar}>
      <TextoM variante="chico" suave>{fotos.length ? `${fotos.length} de ${MAX_FOTOS} · toca una para verla en grande` : `Hasta ${MAX_FOTOS} fotos de lo que viste en terreno. Solo para ti: no salen en el PDF.`}</TextoM>
      <TarjetaM>
        <View style={e.fila}>
          <BotonM titulo="Tomar foto" icono="camara" onPress={() => void agregar('camara')} disabled={quedan <= 0} style={e.mitad} />
          <BotonM titulo="Galería" icono="galeria" variante="secundario" onPress={() => void agregar('galeria')} disabled={quedan <= 0} style={e.mitad} />
        </View>
        {preparando > 0 ? (
          <View style={e.guardando}>
            <ActivityIndicator size={16} color={t.acento} />
            <TextoM variante="chico" suave>Guardando {preparando} {preparando === 1 ? 'foto' : 'fotos'}…</TextoM>
          </View>
        ) : null}
        {fotos.length ? (
          <View onLayout={(ev) => setAncho(ev.nativeEvent.layout.width)} style={e.grilla}>
            {lado > 0
              ? fotos.map((f, i) => (
                  <View key={f.id} style={{ width: lado, height: lado }}>
                    <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Foto ${i + 1} de ${fotos.length}. Ver en grande`} onPress={() => setViendo(i)} style={e.llenar}>
                      <Image source={fuenteDe(f)} recyclingKey={f.id} contentFit="cover" transition={150} style={[e.llenar, e.foto, { backgroundColor: t.campo }]} />
                    </Pressable>
                    {/* Aún no sube (se tomó sin conexión): una marca en la esquina. */}
                    {f.local_uri ? (
                      <View accessibilityLabel="Pendiente de subir" style={[e.insignia, e.abajoIzq]}>
                        <Icono nombre="sincronizar" tamano={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Quitar la foto ${i + 1}`} hitSlop={8} onPress={() => quitar(f.id)} style={({ pressed }) => [e.insignia, e.arribaDer, { opacity: pressed ? 0.6 : 1 }]}>
                      <Icono nombre="cerrar" tamano={13} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))
              : null}
          </View>
        ) : (
          <View style={[e.vacio, { borderColor: t.bordeCampo }]}>
            <Icono nombre="galeria" tamano={22} color={t.suave} />
            <TextoM variante="chico" suave style={e.centrado}>Aún no hay fotos. Toma una o elige de la galería.</TextoM>
          </View>
        )}
      </TarjetaM>
      {viendo !== null && fotos.length ? (
        <VisorFotos fotos={fotos} inicial={Math.min(viendo, fotos.length - 1)} alCerrar={() => setViendo(null)} alQuitar={(id) => void quitarFoto(id).catch((err) => avisar.error('No se pudo quitar', mensajeDe(err)))} />
      ) : null}
      {dialogo}
    </HojaM>
  );
}

// Las fotos en grande, a pantalla completa sobre negro: se pasa de una a otra deslizando; arriba, cerrar, cuál es y quitarla. Su
// confirmación se dibuja aquí adentro: en iOS, una pedida desde la hoja de abajo quedaría detrás del visor.
function VisorFotos({ fotos, inicial, alCerrar, alQuitar }: { fotos: Foto[]; inicial: number; alCerrar: () => void; alQuitar: (id: string) => void }) {
  const { width, height } = useWindowDimensions();
  const arriba = useSafeAreaInsets().top;
  const { dialogo, decidir } = useDialogo();
  const [indice, setIndice] = useState(inicial);
  const actual = fotos[Math.min(indice, fotos.length - 1)];
  const quitarActual = (id: string) =>
    decidir('¿Quitar esta foto?', 'Se elimina del presupuesto.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          // Si era la última, se cierra el visor; si no, se queda en la que pasa a ocupar su lugar.
          if (fotos.length <= 1) alCerrar();
          else setIndice((n) => Math.min(n, fotos.length - 2));
          alQuitar(id);
        },
      },
    ]);
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={alCerrar}>
      <View style={e.visor}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: inicial * width, y: 0 }}
          onMomentumScrollEnd={(ev) => setIndice(Math.round(ev.nativeEvent.contentOffset.x / width))}
        >
          {fotos.map((f, i) => (
            <Image key={f.id} source={fuenteDe(f)} recyclingKey={f.id} contentFit="contain" accessibilityLabel={`Foto ${i + 1} de ${fotos.length}`} style={{ width, height }} />
          ))}
        </ScrollView>
        <View style={[e.barraVisor, { paddingTop: arriba + espacio.s }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8} onPress={alCerrar} style={({ pressed }) => [e.botonVisor, { opacity: pressed ? 0.6 : 1 }]}>
            <Icono nombre="cerrar" tamano={20} color="#FFFFFF" />
          </Pressable>
          <Text variant="titleMedium" style={e.textoVisor}>{Math.min(indice, fotos.length - 1) + 1} de {fotos.length}</Text>
          {actual ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar esta foto"
              hitSlop={8}
              onPress={() => quitarActual(actual.id)}
              style={({ pressed }) => [e.botonVisor, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icono nombre="papelera" tamano={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={e.botonVisor} />
          )}
        </View>
        {dialogo}
      </View>
    </Modal>
  );
}

// ── Voz ───────────────────────────────────────────────────────────────────────────────────────
// La hoja de Notas de voz. `grabarAlAbrir`: viene del botón «Voz» de la visita y empieza a grabar al abrirse. Cerrarla mientras graba
// (Listo, deslizar o «atrás» en Android) primero detiene y guarda la nota.
export function HojaVoz({ q, cambiar, grabarAlAbrir, alCerrar }: Props & { grabarAlAbrir?: boolean; alCerrar: () => void }) {
  const voz = useRef<ControlVoz>(null);
  async function cerrar() {
    if (voz.current?.grabando()) await voz.current.detener();
    alCerrar();
  }
  return (
    <HojaM titulo="Notas de voz" listo={{ titulo: 'Listo', fuerte: true, onPress: () => void cerrar() }} alCerrar={() => void cerrar()}>
      <TextoM variante="chico" suave>{`${q.survey.voice_notes.length} de ${MAX_VOCES} · hasta 5 minutos cada una. Solo para ti: no salen en el PDF.`}</TextoM>
      <Voz ref={voz} q={q} cambiar={cambiar} grabarAlAbrir={grabarAlAbrir} />
    </HojaM>
  );
}

// `ref`: la hoja pregunta si está grabando y, al cerrarse, detiene y guarda.
function Voz({ q, cambiar, grabarAlAbrir, ref }: Props & { grabarAlAbrir?: boolean; ref?: Ref<ControlVoz> }) {
  const t = useTema();
  const reducido = useReducedMotion();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); // .m4a (AAC) en iOS y Android
  const { dialogo, decidir } = useDialogo();
  const estado = useAudioRecorderState(recorder);
  const [guardando, setGuardando] = useState(false);
  const corte = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notas = q.survey.voice_notes;
  const llenas = notas.length >= MAX_VOCES;

  async function empezar() {
    if (llenas) return avisar.aviso('Máximo de notas', `Cada presupuesto admite hasta ${MAX_VOCES} notas de voz.`);
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

  useImperativeHandle(ref, () => ({ grabando: () => recorder.isRecording, detener }));
  useEffect(() => () => clearTimeout(corte.current), []); // al salir no queda un corte pendiente
  // Desde el botón «Voz»: graba apenas se abre la hoja (una sola vez).
  const yaGrabo = useRef(false);
  useEffect(() => {
    if (!grabarAlAbrir || yaGrabo.current) return;
    yaGrabo.current = true;
    void empezar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grabarAlAbrir]);

  const grabando = estado.isRecording;
  const segundos = estado.durationMillis / 1000;
  const fondoBoton = grabando ? t.error : t.acento;

  return (
    <>
      <TarjetaM>
        {/* El botón de grabar, grande y al centro: rojo con ■ mientras graba. Debajo, qué pasa al tocarlo. */}
        <View style={e.grabadora}>
          <TouchableRipple
            accessibilityRole="button"
            accessibilityLabel={grabando ? `Grabando, ${mmss(segundos)}. Detener y guardar` : 'Grabar nota de voz'}
            accessibilityState={{ disabled: guardando || (llenas && !grabando), busy: guardando }}
            disabled={guardando || (llenas && !grabando)}
            onPress={() => void (grabando ? detener() : empezar())}
            borderless
            rippleColor="rgba(255, 255, 255, 0.3)"
            style={[e.botonGrabar, { backgroundColor: fondoBoton, opacity: llenas && !grabando ? 0.4 : 1 }]}
          >
            <View style={e.centro}>
              {guardando ? <ActivityIndicator color={t.sobreAcento} /> : <Icono nombre={grabando ? 'detener' : 'microfono'} tamano={30} color={grabando ? '#FFFFFF' : t.sobreAcento} />}
            </View>
          </TouchableRipple>
          {grabando ? (
            <View style={e.enVivo}>
              {/* El punto rojo late mientras graba (animación CSS de Reanimated, en bucle); con «reducir movimiento» queda fijo. */}
              <Animated.View style={[e.puntoRojo, { backgroundColor: t.error }, reducido ? null : LATIDO]} />
              <Text variant="titleMedium" style={[e.tiempo, { color: t.error }]}>{mmss(segundos)}</Text>
              <TextoM variante="chico" suave>· toca para detener y guardar</TextoM>
            </View>
          ) : (
            <TextoM variante="chico" suave style={e.centrado}>{guardando ? 'Guardando la nota…' : llenas ? `Ya tienes ${MAX_VOCES} notas de voz.` : 'Toca para grabar lo que te pidió el cliente.'}</TextoM>
          )}
        </View>
        {notas.length ? (
          <View>
            {notas.map((n, i) => (
              <Fragment key={n.id}>
                <Divider />
                <NotaDeVoz
                  nota={n}
                  numero={i + 1}
                  alBorrar={async () => {
                    cambiar((p) => conSurvey(p, { voice_notes: p.survey.voice_notes.filter((v) => v.id !== n.id) }));
                    if (!(await descartarSubida(q.id, n.id))) await encolar({ quote_id: q.id, method: 'DELETE', path: `/quotes/${q.id}/voice-notes/${n.id}` });
                  }}
                />
              </Fragment>
            ))}
          </View>
        ) : null}
      </TarjetaM>
      {dialogo}
    </>
  );
}

function NotaDeVoz({ nota, numero, alBorrar }: { nota: Presupuesto['survey']['voice_notes'][number]; numero: number; alBorrar: () => Promise<void> }) {
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
    <View style={e.nota}>
      <TouchableRipple accessibilityRole="button" accessibilityLabel={`${playing ? 'Pausar' : 'Escuchar'} la nota de voz ${numero}, ${mmss(nota.duration_seconds)}`} onPress={() => void alternar()} borderless style={e.reproducir}>
        <View style={e.filaNota}>
          <View style={[e.circulo, { backgroundColor: `${t.acento}1F` }]}>
            <Icono nombre={playing ? 'pausar' : 'reproducir'} tamano={18} color={t.acento} />
          </View>
          <View style={e.flex}>
            <Text variant="bodyLarge">Nota de voz {numero}</Text>
            <Text variant="bodySmall" style={[e.tiempo, { color: playing ? t.acento : t.suave }]}>{playing ? 'Reproduciendo · ' : ''}{mmss(nota.duration_seconds)}{nota.local_uri ? ' · pendiente de subir' : ''}</Text>
          </View>
        </View>
      </TouchableRipple>
      <Pressable accessibilityRole="button" accessibilityLabel={`Quitar la nota de voz ${numero}`} onPress={quitar} hitSlop={4} style={({ pressed }) => [e.quitar, { opacity: pressed ? 0.5 : 1 }]}>
        <Icono nombre="papelera" tamano={18} color={t.suave} />
      </Pressable>
      {dialogo}
    </View>
  );
}

// El punto rojo late: de opaco a tenue y de vuelta, 0,7 s cada ida, sin fin (animación CSS de Reanimated, en el hilo de la interfaz). Fuera
// de StyleSheet.create: sus tipos (los de React Native) no conocen las animaciones CSS.
const LATIDO = { animationName: { from: { opacity: 1 }, to: { opacity: 0.25 } }, animationDuration: '700ms', animationIterationCount: 'infinite', animationDirection: 'alternate', animationTimingFunction: 'ease-in-out' } as const;

const e = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centrado: { textAlign: 'center' },
  circulo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  miniaturas: { flexDirection: 'row', gap: 6, marginTop: espacio.s },
  miniatura: { width: 52, height: 52, borderRadius: 10 },
  mas: { alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  guardando: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIO_GRILLA },
  llenar: { width: '100%', height: '100%' },
  foto: { borderRadius: radio.s },
  // Las marcas sobre cada foto: un círculo oscuro translúcido (se lee sobre cualquier foto) con el ícono en blanco.
  insignia: { position: 'absolute', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  arribaDer: { top: 6, right: 6 },
  abajoIzq: { bottom: 6, left: 6 },
  vacio: { alignItems: 'center', gap: espacio.s, borderWidth: 1, borderStyle: 'dashed', borderRadius: radio.m, paddingVertical: espacio.xl, paddingHorizontal: espacio.l },
  visor: { flex: 1, backgroundColor: '#000000' },
  barraVisor: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingBottom: espacio.s, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  botonVisor: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  textoVisor: { color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  grabadora: { alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s },
  botonGrabar: { width: 72, height: 72, borderRadius: 36 },
  enVivo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  puntoRojo: { width: 10, height: 10, borderRadius: 5 },
  tiempo: { fontVariant: ['tabular-nums'] },
  nota: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  reproducir: { flex: 1, borderRadius: radio.s, paddingVertical: espacio.s },
  filaNota: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  quitar: { width: MIN_TOQUE, height: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' },
});
