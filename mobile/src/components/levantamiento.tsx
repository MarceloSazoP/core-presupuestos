import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Fragment, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Divider, Text, TouchableRipple } from 'react-native-paper';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { HojaTexto } from '@/components/campo-modal';
import { HojaDireccion, MiniMapa, type DireccionConPunto } from '@/components/direccion-mapa';
import { FilaVisita, GrupoVisita } from '@/components/fila-visita';
import { BotonM, CampoM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { HojaFotos, HojaVoz, MiniaturasFotos, mmss, useFotos } from '@/components/multimedia';
import { Icono, type NombreIcono } from '@/components/ui';
import { puntoDe } from '@/lib/direccion';
import { encolar } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Etapa 2 del wizard (CLAUDE.md §10): la visita, lo que se ve en terreno. Funciona sin conexión: cada cambio se guarda en el teléfono y
// la cola de envío (sync/cola.ts) lo sube después.
//
// Organización (rediseño): arriba, la captura rápida (Foto, Voz, Medida, Nota), que es lo que más se hace en terreno; debajo, dos grupos
// según quién ve cada cosa: «Para el cliente» (servicio y dirección, salen en el PDF) y «Solo para ti» (notas, medidas, fotos y voz).
// Cada cosa es una fila que solo muestra lo que hay; tocarla abre su hoja para editar. En «Solo para ti» solo aparecen las filas que
// tienen algo; sin nada, un mensaje que dice cómo empezar.
const MAX_MEDIDAS = 50;

type Cambiar = (f: (q: Presupuesto) => Presupuesto) => void; // actualiza la copia local del presupuesto
type Props = { q: Presupuesto; cambiar: Cambiar };
type Abierta = 'servicio' | 'direccion' | 'notas' | 'medidas' | 'fotos' | 'voz';
const conSurvey = (q: Presupuesto, s: Partial<Presupuesto['survey']>): Presupuesto => ({ ...q, survey: { ...q.survey, ...s } });

export function Levantamiento({ q, cambiar }: Props) {
  const t = useTema();
  const [abierta, setAbierta] = useState<Abierta | null>(null);
  const [desdeCaptura, setDesdeCaptura] = useState(false); // la hoja se abrió con la captura rápida: grabar al tiro o una medida nueva
  const fotos = useFotos(q, cambiar);
  const trabajo = useTrabajo(q, cambiar);
  const notas = useNotas(q, cambiar);

  const abrir = (que: Abierta, captura = false) => {
    setDesdeCaptura(captura);
    setAbierta(que);
  };
  const cerrar = () => setAbierta(null);

  const s = q.survey;
  const punto = puntoDe(q.latitude ?? null, q.longitude ?? null);
  const medidas = s.measurements.map((m) => `${m.label} ${m.value}`).join(' · ');
  const voces = s.voice_notes.map((v) => mmss(v.duration_seconds));
  const capturado = !!s.notes?.trim() || s.measurements.length > 0 || s.photos.length > 0 || s.voice_notes.length > 0 || fotos.preparando > 0;

  return (
    <>
      {/* Captura rápida: lo que más se hace en terreno, a un toque. Foto abre la cámara; Voz abre su hoja grabando. */}
      <View style={e.captura}>
        <Captura icono="camara" texto="Foto" alTocar={() => void fotos.agregar('camara')} />
        <Captura icono="microfono" texto="Voz" alTocar={() => abrir('voz', true)} />
        <Captura icono="regla" texto="Medida" alTocar={() => abrir('medidas', true)} />
        <Captura icono="lapiz" texto="Nota" alTocar={() => abrir('notas', true)} />
      </View>

      <GrupoVisita titulo="Para el cliente" nota="Sale en el PDF">
        <FilaVisita icono="trabajo" etiqueta="Servicio" valor={q.service_description} vacio="Describe el trabajo" insignia="Obligatorio para terminar" alTocar={() => abrir('servicio')} />
        <FilaVisita
          icono="ubicacion"
          etiqueta="Dirección"
          valor={q.address || (punto ? 'Punto marcado en el mapa' : null)}
          vacio="Agregar dirección"
          ayuda="Opcional · puedes marcarla en el mapa"
          derecha={punto && Platform.OS !== 'web' ? <MiniMapa latitude={punto.latitude} longitude={punto.longitude} /> : undefined}
          alTocar={() => abrir('direccion')}
        />
      </GrupoVisita>
      {trabajo.error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{trabajo.error}</TextoM> : null}

      <GrupoVisita titulo="Solo para ti" nota="No sale en el PDF" candado>
        {capturado ? (
          // Un arreglo (no un Fragment): el grupo pone la línea entre cada fila que sí está.
          [
            s.notes?.trim() ? <FilaVisita key="notas" icono="lapiz" etiqueta="Notas" valor={s.notes} alTocar={() => abrir('notas')} /> : null,
            s.measurements.length ? <FilaVisita key="medidas" icono="regla" etiqueta={`Medidas · ${s.measurements.length}`} valor={medidas} alTocar={() => abrir('medidas')} /> : null,
            s.photos.length || fotos.preparando ? (
              <FilaVisita key="fotos" icono="galeria" etiqueta={`Fotos · ${s.photos.length}`} valor={fotos.preparando ? `Guardando ${fotos.preparando === 1 ? 'la foto' : `${fotos.preparando} fotos`}…` : null} accessibilityLabel={`Fotos: ${s.photos.length}. Ver y quitar`} alTocar={() => abrir('fotos')}>
                {s.photos.length ? <MiniaturasFotos fotos={s.photos} /> : null}
              </FilaVisita>
            ) : null,
            s.voice_notes.length ? <FilaVisita key="voz" icono="microfono" etiqueta={`Notas de voz · ${s.voice_notes.length}`} valor={`${voces.length > 1 ? `${voces.slice(0, -1).join(', ')} y ${voces[voces.length - 1]}` : voces[0]} · toca para escuchar`} alTocar={() => abrir('voz')} /> : null,
          ]
        ) : (
          <View style={e.vacio}>
            <View style={[e.circulo, { backgroundColor: `${t.acento}1F` }]}>
              <Icono nombre="camara" tamano={22} color={t.acento} />
            </View>
            <Text variant="titleSmall">Aún no capturas nada</Text>
            <Text variant="bodySmall" style={[e.centrado, { color: t.suave }]}>Usa Foto, Voz, Medida o Nota de arriba. Lo que agregues aparece aquí, solo para ti.</Text>
          </View>
        )}
      </GrupoVisita>
      {notas.estado && notas.estado !== 'Guardado' ? <TextoM variante="chico" color="error" accessibilityRole="alert">{notas.estado}</TextoM> : null}

      {abierta === 'servicio' ? (
        <HojaTexto titulo="Servicio" etiqueta="Servicio" inicial={q.service_description} placeholder="Por ejemplo: instalar puerta" multiline maxPalabras={69} entrada={{ maxLength: 2000 }} alListo={(v) => { cerrar(); trabajo.guardarServicio(v); }} alCerrar={cerrar} />
      ) : null}
      {abierta === 'direccion' ? (
        Platform.OS === 'web' ? (
          <HojaTexto titulo="Dirección" etiqueta="Dirección" inicial={q.address ?? ''} multiline={false} entrada={{ maxLength: 300 }} alListo={(v) => { cerrar(); trabajo.guardarDireccion({ direccion: v, latitude: null, longitude: null }); }} alCerrar={cerrar} />
        ) : (
          <HojaDireccion inicial={q.address ?? ''} puntoInicial={punto} alListo={(d) => { cerrar(); trabajo.guardarDireccion(d); }} alCerrar={cerrar} />
        )
      ) : null}
      {abierta === 'notas' ? (
        <HojaTexto titulo="Notas" etiqueta="Notas" inicial={s.notes ?? ''} placeholder="Qué viste, qué pidió el cliente, lo que no puedes olvidar" multiline entrada={{}} alListo={(v) => { cerrar(); notas.guardar(v); }} alCerrar={cerrar} />
      ) : null}
      {abierta === 'medidas' ? <HojaMedidas q={q} cambiar={cambiar} nueva={desdeCaptura || s.measurements.length === 0} alCerrar={cerrar} /> : null}
      {abierta === 'fotos' ? <HojaFotos q={q} cambiar={cambiar} alCerrar={cerrar} /> : null}
      {abierta === 'voz' ? <HojaVoz q={q} cambiar={cambiar} grabarAlAbrir={desdeCaptura} alCerrar={cerrar} /> : null}
      {fotos.dialogo}
    </>
  );
}

// Un botón de la captura rápida: el ícono en el acento sobre su tono suave y el nombre debajo.
function Captura({ icono, texto, alTocar }: { icono: NombreIcono; texto: string; alTocar: () => void }) {
  const t = useTema();
  return (
    <TouchableRipple
      accessibilityRole="button"
      accessibilityLabel={texto === 'Foto' ? 'Tomar una foto' : texto === 'Voz' ? 'Grabar una nota de voz' : texto === 'Medida' ? 'Agregar una medida' : 'Escribir una nota'}
      onPress={() => {
        void Haptics.selectionAsync();
        alTocar();
      }}
      borderless
      style={[e.botonCaptura, { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1A'}` }]}
    >
      <View style={e.contenidoCaptura}>
        <Icono nombre={icono} tamano={24} color={t.acento} />
        <Text variant="labelLarge" style={{ color: t.texto }}>{texto}</Text>
      </View>
    </TouchableRipple>
  );
}

// ── Servicio y dirección ──────────────────────────────────────────────────────────────────────
// Salen en el PDF. Se pueden corregir mientras el presupuesto está pendiente. Sin conexión se guardan en el teléfono y viajan por la
// cola; PATCH sobre la misma ruta reemplaza al pendiente. Latitud y longitud van juntas o ninguna (Contrato API §6).
function useTrabajo(q: Presupuesto, cambiar: Cambiar) {
  const [error, setError] = useState<string | null>(null);
  async function guardar(servicio: string, d: DireccionConPunto) {
    const cuerpo = { service_description: servicio.trim() || null, address: d.direccion.trim() || null, latitude: d.latitude, longitude: d.longitude };
    try {
      cambiar((p) => ({ ...p, service_description: servicio.trim(), address: cuerpo.address, latitude: d.latitude, longitude: d.longitude }));
      await encolar({ quote_id: q.id, method: 'PATCH', path: `/quotes/${q.id}`, body: cuerpo });
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }
  const actual: DireccionConPunto = { direccion: q.address ?? '', latitude: q.latitude ?? null, longitude: q.longitude ?? null };
  return {
    error,
    guardarServicio: (v: string) => {
      if (v !== q.service_description) void guardar(v, actual);
    },
    guardarDireccion: (d: DireccionConPunto) => {
      if (d.direccion !== actual.direccion || d.latitude !== actual.latitude || d.longitude !== actual.longitude) void guardar(q.service_description, d);
    },
  };
}

// ── Notas ─────────────────────────────────────────────────────────────────────────────────────
function useNotas(q: Presupuesto, cambiar: Cambiar) {
  const [estado, setEstado] = useState<string | null>(null);
  async function guardar(notas: string) {
    if (notas === (q.survey.notes ?? '')) return;
    try {
      cambiar((p) => conSurvey(p, { notes: notas.trim() || null }));
      await encolar({ quote_id: q.id, method: 'PUT', path: `/quotes/${q.id}/survey`, body: { notes: notas.trim() || null } });
      setEstado('Guardado');
    } catch (err) {
      setEstado(mensajeDe(err));
    }
  }
  return { estado, guardar: (v: string) => void guardar(v) };
}

// ── Medidas ───────────────────────────────────────────────────────────────────────────────────
// En su hoja: cada medida con qué se mide y cuánto, en campos de Material, y su papelera. Se guardan al salir de cada campo y al cerrar.
// `nueva`: se abre con una fila vacía y el cursor en ella (desde la captura rápida, o si todavía no hay medidas).
type FilaMedida = { clave: string; id: string; label: string; value: string }; // el id lo genera el teléfono: así el reintento no duplica

function HojaMedidas({ q, cambiar, nueva, alCerrar }: Props & { nueva: boolean; alCerrar: () => void }) {
  const t = useTema();
  // La fila que recibe el cursor: la vacía con que se abre o la última que se agregó.
  const [enfocar, setEnfocar] = useState<string | null>(() => (nueva ? randomUUID() : null));
  const [filas, setFilas] = useState<FilaMedida[]>(() => {
    const base = q.survey.measurements.map((m) => ({ clave: m.id, id: m.id, label: m.label, value: m.value }));
    return enfocar ? [...base, { clave: enfocar, id: enfocar, label: '', value: '' }] : base;
  });
  const [error, setError] = useState<string | null>(null);

  // El servidor reemplaza la lista completa y su orden (PUT): se envían solo las filas completas.
  async function guardar(lista: FilaMedida[]) {
    const medidas = lista.filter((f) => f.label.trim() && f.value.trim()).map((f) => ({ id: f.id, label: f.label.trim(), value: f.value.trim() }));
    const antes = q.survey.measurements;
    if (medidas.length === antes.length && medidas.every((m, i) => m.id === antes[i]?.id && m.label === antes[i]?.label && m.value === antes[i]?.value)) return;
    try {
      cambiar((p) => conSurvey(p, { measurements: medidas }));
      await encolar({ quote_id: q.id, method: 'PUT', path: `/quotes/${q.id}/measurements`, body: { measurements: medidas } });
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  const editar = (clave: string, campo: 'label' | 'value', v: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: v } : f)));
  const quitar = (clave: string) => {
    const resto = filas.filter((f) => f.clave !== clave);
    setFilas(resto);
    void guardar(resto);
  };
  const agregar = () => {
    const id = randomUUID();
    setEnfocar(id);
    setFilas((fs) => [...fs, { clave: id, id, label: '', value: '' }]);
  };
  const cerrar = () => {
    void guardar(filas);
    alCerrar();
  };

  return (
    <HojaM titulo="Medidas" listo={{ titulo: 'Listo', fuerte: true, onPress: cerrar }} alCerrar={cerrar}>
      <View style={e.candado}>
        <Icono nombre="candado" tamano={13} color={t.suave} />
        <Text variant="bodySmall" style={{ color: t.suave }}>Solo para ti · no sale en el PDF</Text>
      </View>
      <TarjetaM>
        {filas.map((f, i) => (
          <Fragment key={f.clave}>
            {i > 0 ? <Divider /> : null}
            <View style={e.filaMedida}>
              <View style={e.que}>
                <CampoM etiqueta="Qué mides" value={f.label} onChangeText={(v) => editar(f.clave, 'label', v)} onEndEditing={() => void guardar(filas)} placeholder="Ej: Largo living" autoFocus={f.clave === enfocar} autoCapitalize="sentences" />
              </View>
              <View style={e.cuanto}>
                <CampoM etiqueta="Medida" value={f.value} onChangeText={(v) => editar(f.clave, 'value', v.replace(/[^\d.,]/g, ''))} onEndEditing={() => void guardar(filas)} placeholder="3,5" keyboardType="decimal-pad" />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${f.label || 'esta medida'}`} onPress={() => quitar(f.clave)} hitSlop={4} style={({ pressed }) => [e.quitar, { opacity: pressed ? 0.5 : 1 }]}>
                <Icono nombre="papelera" tamano={20} color={t.suave} />
              </Pressable>
            </View>
          </Fragment>
        ))}
        <BotonM titulo="Agregar medida" icono="mas" variante="secundario" disabled={filas.length >= MAX_MEDIDAS} onPress={agregar} />
      </TarjetaM>
      {error ? <TextoM variante="chico" color="error" accessibilityRole="alert">{error}</TextoM> : null}
      <TextoM variante="chico" suave>Se guardan solas al salir de cada campo. En «Medida» va solo el número; la unidad, si importa, en «Qué mides» (ej: Largo living en m).</TextoM>
    </HojaM>
  );
}

const e = StyleSheet.create({
  captura: { flexDirection: 'row', gap: espacio.s },
  botonCaptura: { flex: 1, height: 76, borderRadius: 16 },
  contenidoCaptura: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  vacio: { alignItems: 'center', gap: espacio.s, paddingVertical: 28, paddingHorizontal: espacio.xl },
  circulo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  centrado: { textAlign: 'center' },
  candado: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: espacio.xs },
  filaMedida: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  que: { flex: 3 },
  cuanto: { flex: 2 },
  quitar: { width: MIN_TOQUE, height: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' },
});
