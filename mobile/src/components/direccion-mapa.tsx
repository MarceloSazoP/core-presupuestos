import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api } from '@/api/client';
import { CampoModal } from '@/components/campo-modal';
import { Boton, Campo, Icono, Texto, type NombreIcono } from '@/components/ui';
import { formatearDireccion, puntoDe, redondear, sesionNueva, type Punto } from '@/lib/direccion';
import { avisar } from '@/lib/toast';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// La dirección del trabajo con mapa (docs/Ubicación y mapa.md): el texto y, debajo, un mapa con el punto. Se edita en una hoja:
// escribir la dirección con sugerencias (al elegir una, el mapa va a ese punto), tocar el mapa o arrastrar el pin, o «Usar mi
// ubicación» con el GPS. Sin sugerencias disponibles (el backend sin clave de Google) se busca lo escrito con el geocodificador del
// teléfono. Lo que se guarda: dirección, latitud y longitud, solo al tocar «Listo».
export type DireccionConPunto = { direccion: string; latitude: number | null; longitude: number | null };
type Props = { etiqueta: string; direccion: string; latitude?: number | null; longitude?: number | null; alCambiar: (d: DireccionConPunto) => void };
type Sugerencia = { id: string; text: string };

const SANTIAGO = { latitude: -33.4489, longitude: -70.6693, latitudeDelta: 0.12, longitudeDelta: 0.12 };
const ZOOM = 0.004;

export function DireccionMapa({ etiqueta, direccion, latitude, longitude, alCambiar }: Props) {
  const t = useTema();
  const [abierta, setAbierta] = useState(false);
  const punto = puntoDe(latitude, longitude);
  // La web (vista previa en el navegador) no trae mapas nativos: solo el texto.
  if (Platform.OS === 'web') {
    return <CampoModal etiqueta={etiqueta} titulo="Dirección" agregar="Agregar dirección" icono="ubicacion" valor={direccion} alCambiar={(v) => alCambiar({ direccion: v, latitude: null, longitude: null })} multiline={false} maxLength={300} />;
  }
  const lleno = direccion.trim().length > 0 || punto !== null;
  return (
    <View style={e.campo}>
      <Texto variante="chico" fuerte>{etiqueta}</Texto>
      {lleno ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${direccion || 'punto en el mapa'}. Editar`} onPress={() => setAbierta(true)} style={({ pressed }) => [e.tarjeta, { backgroundColor: t.tarjeta, borderColor: t.bordeCampo, opacity: pressed ? 0.7 : 1 }]}>
          <Icono nombre="ubicacion" tamano={18} color={t.acento} />
          <Texto style={e.flex}>{direccion || 'Punto marcado en el mapa'}</Texto>
          <Icono nombre="lapiz" tamano={18} color={t.acento} />
        </Pressable>
      ) : (
        <Boton titulo="Agregar dirección" icono="ubicacion" variante="secundario" onPress={() => setAbierta(true)} />
      )}
      {punto ? (
        // Vista previa: el mapa no se mueve; tocarlo abre la hoja para corregir el punto.
        <Pressable accessibilityRole="button" accessibilityLabel="Ver y mover el punto en el mapa" onPress={() => setAbierta(true)} style={[e.vista, { borderColor: t.borde }]}>
          <MapView pointerEvents="none" liteMode style={e.flex} initialRegion={{ ...punto, latitudeDelta: ZOOM, longitudeDelta: ZOOM }} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}>
            <Marker coordinate={punto} />
          </MapView>
        </Pressable>
      ) : null}
      {lleno ? (
        <View style={e.acciones}>
          <Pastilla icono="papelera" texto="Quitar dirección" tono={t.error} alTocar={() => { alCambiar({ direccion: '', latitude: null, longitude: null }); avisar.info('Dirección quitada'); }} />
        </View>
      ) : null}
      {abierta ? (
        <Hoja
          inicial={direccion}
          puntoInicial={punto}
          alListo={(d) => {
            setAbierta(false);
            alCambiar(d);
          }}
          alCerrar={() => setAbierta(false)}
        />
      ) : null}
    </View>
  );
}

function Hoja({ inicial, puntoInicial, alListo, alCerrar }: { inicial: string; puntoInicial: Punto | null; alListo: (d: DireccionConPunto) => void; alCerrar: () => void }) {
  const t = useTema();
  const [texto, setTexto] = useState(inicial);
  const [punto, setPunto] = useState<Punto | null>(puntoInicial);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [sinSugerencias, setSinSugerencias] = useState(false); // el backend no tiene sugerencias (503): se busca con el teléfono
  const [gps, setGps] = useState(false);
  const [desplazable, setDesplazable] = useState(true); // mientras se toca el mapa, la hoja no se desplaza: si no, se llevaba el gesto y el mapa no recibía el toque ni el zoom
  const mapa = useRef<MapView>(null);
  const escrita = useRef(inicial.trim().length > 0); // la persona escribió o eligió el texto: el pin ya no lo cambia
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sesion = useRef(sesionNueva(randomUUID()));

  useEffect(() => () => void (espera.current && clearTimeout(espera.current)), []);
  // Sin punto, el mapa parte donde estuvo el teléfono por última vez (solo si el permiso ya estaba dado: aquí no se pide nada).
  useEffect(() => {
    if (puntoInicial) return;
    void (async () => {
      const permiso = await Location.getForegroundPermissionsAsync();
      if (permiso.status !== 'granted') return;
      const ultima = await Location.getLastKnownPositionAsync();
      if (ultima) mapa.current?.animateToRegion({ latitude: ultima.coords.latitude, longitude: ultima.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 0);
    })().catch(() => {});
  }, [puntoInicial]);

  // Marca el punto y lleva el mapa ahí; con `rellenar`, si el texto no lo puso la persona, lo completa con la dirección del punto.
  const poner = (p: Punto, rellenar: boolean) => {
    const q = { latitude: redondear(p.latitude), longitude: redondear(p.longitude) };
    setPunto(q);
    mapa.current?.animateToRegion({ ...q, latitudeDelta: ZOOM, longitudeDelta: ZOOM }, 350);
    if (rellenar && !escrita.current) {
      void Location.reverseGeocodeAsync(q)
        .then((r) => {
          const d = formatearDireccion(r[0]);
          if (d) setTexto(d);
        })
        .catch(() => {});
    }
  };

  const escribir = (v: string) => {
    setTexto(v);
    escrita.current = true;
    if (espera.current) clearTimeout(espera.current);
    if (v.trim().length < 3) return setSugerencias([]);
    espera.current = setTimeout(() => {
      void api<{ suggestions: Sugerencia[] }>('/places/autocomplete', { method: 'POST', body: { input: v.trim(), session: sesion.current } })
        .then((r) => {
          setSugerencias(r.suggestions);
          setSinSugerencias(false);
        })
        .catch((err) => {
          setSugerencias([]);
          if ((err as { status?: number }).status === 503) setSinSugerencias(true);
        });
    }, 350);
  };

  const elegir = async (s: Sugerencia) => {
    Keyboard.dismiss();
    setSugerencias([]);
    setTexto(s.text);
    escrita.current = true;
    try {
      const d = await api<{ address: string; latitude: number; longitude: number }>(`/places/${encodeURIComponent(s.id)}?session=${sesion.current}`);
      setTexto(d.address || s.text);
      poner({ latitude: d.latitude, longitude: d.longitude }, false);
      sesion.current = sesionNueva(randomUUID()); // la siguiente dirección es otra sesión
    } catch {
      avisar.error('No se pudo ubicar esa dirección', 'Toca el mapa para marcar el punto.');
    }
  };

  // Sin sugerencias: busca lo escrito con el geocodificador del teléfono.
  const buscar = async () => {
    Keyboard.dismiss();
    try {
      const r = await Location.geocodeAsync(texto.trim());
      if (!r[0]) return avisar.aviso('No encontramos esa dirección', 'Revisa cómo está escrita o toca el mapa para marcar el punto.');
      poner({ latitude: r[0].latitude, longitude: r[0].longitude }, false);
    } catch {
      avisar.error('No se pudo buscar la dirección', 'Toca el mapa para marcar el punto.');
    }
  };

  // Vacía la caja de dirección (y sus sugerencias); el pin se quita aparte, con «Quitar punto».
  const limpiar = () => {
    if (espera.current) clearTimeout(espera.current);
    setTexto('');
    setSugerencias([]);
    escrita.current = false; // sin texto de la persona, el próximo pin vuelve a completar la dirección
  };

  const usarGps = async () => {
    setGps(true);
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') return avisar.aviso('Sin permiso de ubicación', 'Actívalo en Ajustes, o toca el mapa para marcar el punto.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      poner({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, true);
    } catch {
      avisar.error('No se pudo obtener tu ubicación', 'Prueba de nuevo o toca el mapa para marcar el punto.');
    } finally {
      setGps(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={alCerrar} hitSlop={8} style={e.lado}>
            <Texto color="acento">Cancelar</Texto>
          </Pressable>
          <Texto fuerte accessibilityRole="header">Dirección</Texto>
          <View style={e.lado} />
        </View>
        <ScrollView scrollEnabled={desplazable} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={e.contenido}>
          {/* La caja de dirección y, a su lado, el ícono de borrar: vacía lo escrito (por si no quiere dirección o se arrepintió). */}
          <View style={e.filaCampo}>
            <View style={e.flex}>
              <Campo etiqueta="Dirección" icono="ubicacion" value={texto} onChangeText={escribir} maxLength={300} autoComplete="street-address" textContentType="fullStreetAddress" placeholder="Calle y número, comuna" />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar la dirección escrita" disabled={texto.length === 0} onPress={limpiar} hitSlop={6} style={({ pressed }) => [e.borrar, { backgroundColor: `${t.error}1A`, opacity: texto.length === 0 ? 0.35 : pressed ? 0.6 : 1 }]}>
              <Icono nombre="borrar" tamano={22} color={t.error} />
            </Pressable>
          </View>
          {sugerencias.length > 0 ? (
            <View style={[e.sugerencias, { backgroundColor: t.tarjeta, borderColor: t.borde }]}>
              {sugerencias.map((s, i) => (
                <Pressable key={s.id} accessibilityRole="button" onPress={() => void elegir(s)} style={({ pressed }) => [e.sugerencia, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde }, { opacity: pressed ? 0.6 : 1 }]}>
                  <Icono nombre="ubicacion" tamano={16} color={t.suave} />
                  <Texto style={e.flex}>{s.text}</Texto>
                </Pressable>
              ))}
            </View>
          ) : null}
          {sinSugerencias && texto.trim().length >= 3 ? <Boton titulo="Buscar en el mapa" icono="buscar" variante="secundario" onPress={() => void buscar()} /> : null}
          <View style={[e.mapa, { borderColor: t.borde }]} onTouchStart={() => setDesplazable(false)} onTouchEnd={() => setDesplazable(true)} onTouchCancel={() => setDesplazable(true)}>
            <MapView ref={mapa} style={e.flex} initialRegion={puntoInicial ? { ...puntoInicial, latitudeDelta: ZOOM, longitudeDelta: ZOOM } : SANTIAGO} onPress={(ev) => poner(ev.nativeEvent.coordinate, true)} onLongPress={(ev) => poner(ev.nativeEvent.coordinate, true)} zoomEnabled zoomControlEnabled scrollEnabled rotateEnabled={false} showsUserLocation showsMyLocationButton={false}>
              {punto ? <Marker coordinate={punto} draggable onDragEnd={(ev) => poner(ev.nativeEvent.coordinate, true)} /> : null}
            </MapView>
            {/* Los controles viven sobre el mapa, donde se usan: ubicarse (abajo a la izquierda) y quitar el punto (arriba a la derecha). */}
            <Pressable accessibilityRole="button" accessibilityLabel="Usar mi ubicación" onPress={() => void usarGps()} style={({ pressed }) => [e.sobreMapa, e.abajoIzq, { backgroundColor: t.tarjeta, borderColor: t.borde, opacity: pressed ? 0.7 : 1 }]}>
              <Icono nombre="ubicacion" tamano={18} color={t.acento} />
              <Texto variante="chico" fuerte color="acento">{gps ? 'Ubicando…' : 'Mi ubicación'}</Texto>
            </Pressable>
            {punto ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Quitar el punto del mapa" onPress={() => setPunto(null)} style={({ pressed }) => [e.sobreMapa, e.arribaDer, { backgroundColor: t.tarjeta, borderColor: t.borde, opacity: pressed ? 0.7 : 1 }]}>
                <Icono nombre="papelera" tamano={18} color={t.error} />
                <Texto variante="chico" fuerte color="error">Quitar punto</Texto>
              </Pressable>
            ) : null}
          </View>
          <Texto variante="chico" suave>Toca el mapa (o mantén apretado) para marcar el punto, o arrastra el pin para ajustarlo. Con dos dedos haces zoom.</Texto>
          <Boton titulo="Listo" icono="listo" onPress={() => alListo({ direccion: texto.trim(), latitude: punto?.latitude ?? null, longitude: punto?.longitude ?? null })} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Pastilla({ icono, texto, tono, alTocar }: { icono: NombreIcono; texto: string; tono: string; alTocar: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} style={({ pressed }) => [e.pastilla, { backgroundColor: `${tono}1A`, opacity: pressed ? 0.6 : 1 }]}>
      <Icono nombre={icono} tamano={16} color={tono} />
      <Texto variante="chico" fuerte style={{ color: tono }}>{texto}</Texto>
    </Pressable>
  );
}

const e = StyleSheet.create({
  filaCampo: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s },
  borrar: { width: 48, height: 48, borderRadius: radio.m, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  sobreMapa: { position: 'absolute', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: espacio.m, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  abajoIzq: { left: espacio.s, bottom: espacio.s },
  arribaDer: { right: espacio.s, top: espacio.s },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  pastilla: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: espacio.m },
  campo: { gap: espacio.xs },
  flex: { flex: 1 },
  tarjeta: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, borderWidth: 1, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.m, minHeight: MIN_TOQUE },
  vista: { height: 140, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', overflow: 'hidden' },
  hoja: { flex: 1 },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  contenido: { padding: espacio.xl, gap: espacio.m, paddingBottom: espacio.xxl },
  sugerencias: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', overflow: 'hidden' },
  sugerencia: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  mapa: { height: 300, borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', overflow: 'hidden' },
});
