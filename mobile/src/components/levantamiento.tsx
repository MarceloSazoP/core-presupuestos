import { DireccionMapa } from '@/components/direccion-mapa';
import { CampoModal } from '@/components/campo-modal';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { BotonM, NotaM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { Multimedia } from '@/components/multimedia';
import { Icono, TECLADO_ID, type NombreIcono } from '@/components/ui';
import { encolar } from '@/sync/cola';
import { espacio, letra, MIN_TOQUE, useTema } from '@/theme';

// Etapa 2 del wizard (CLAUDE.md §10): lo que se ve en terreno. Notas, medidas, fotos y voz. Todo es interno: nada de esto
// sale en el PDF. Funciona sin conexión: cada cambio se guarda en el teléfono y la cola de envío (sync/cola.ts) lo sube después.
// Las fotos y las notas de voz viven en multimedia.tsx.
const MAX_MEDIDAS = 50;

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

// Rótulo de cada parte de la nota: un ícono y el nombre, con la cuenta cuando hay un máximo.
function Rotulo({ icono, texto }: { icono: NombreIcono; texto: string }) {
  const t = useTema();
  return (
    <View style={e.rotulo}>
      <Icono nombre={icono} tamano={16} color={t.acento} />
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
          <TextInput inputAccessoryViewID={TECLADO_ID} accessibilityLabel="Qué mides" value={f.label} onChangeText={(v) => editarFila(f.clave, 'label', v)} onEndEditing={() => void guardar(filas)} placeholder="Ej: Largo" placeholderTextColor={t.suave} style={[e.entrada, e.etiquetaMedida, { color: t.texto, borderColor: t.bordeCampo }]} />
          <TextInput inputAccessoryViewID={TECLADO_ID} accessibilityLabel="Cuánto mide" keyboardType="decimal-pad" value={f.value} onChangeText={(v) => editarFila(f.clave, 'value', v.replace(/[^\d.,]/g, ''))} onEndEditing={() => void guardar(filas)} placeholder="Ej: 3,5" placeholderTextColor={t.suave} style={[e.entrada, e.valorMedida, { color: t.texto, borderColor: t.bordeCampo }]} />
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

const e = StyleSheet.create({
  bloque: { gap: espacio.s },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaMedida: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  entrada: { minHeight: MIN_TOQUE, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: espacio.m, fontSize: letra.cuerpo },
  etiquetaMedida: { flex: 3 },
  valorMedida: { flex: 2 },
  quitar: { width: MIN_TOQUE, height: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' },
});
