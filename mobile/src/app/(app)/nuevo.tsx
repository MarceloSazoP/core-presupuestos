import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { formaPanel } from '@/components/barra-flotante';
import { BarraListo } from '@/components/barra-listo';
import { CampoTelefono } from '@/components/campo-telefono';
import { useDialogo } from '@/components/dialogo';
import { CampoDireccion } from '@/components/direccion-mapa';
import { BotonM, CampoM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import type { Pais } from '@/lib/paises';
import { palabrasDe, recortarPalabras } from '@/lib/palabras';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { avisar } from '@/lib/toast';
import { encolar, guardarBorrador } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Etapa 1 del wizard (CLAUDE.md §10): cliente, ubicación y descripción inicial. Funciona sin conexión: el presupuesto
// nace en el teléfono con su propio id y se envía por la cola. El servidor entrega el código al recibirlo (sync/cola.ts).
//
// Diseño elegido en el lienzo «Barra fija y Nuevo presupuesto»: arriba la ✕ y el título; debajo, en qué paso va (1 · Cliente, 2 · Visita,
// 3 · Presupuesto); los campos se escriben ahí mismo; y abajo, en un panel, «Crear presupuesto →» (sigue con la visita) y «Guardar para
// después». Igual en iPhone y Android.
const MAX_PALABRAS = 69; // el servicio es una línea para el PDF, no la descripción completa

export default function Nuevo() {
  const t = useTema();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pais = usePais();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState(pais.calling_code); // el país del número del cliente (propuesto: el de tu cuenta)
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [punto, setPunto] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [servicio, setServicio] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const { dialogo, decidir } = useDialogo();

  // Cancelar: si ya escribió algo se pregunta antes de descartar, porque el gesto de deslizar hacia abajo no avisa.
  const hayDatos = [nombre, telefono, correo, direccion, servicio].some((v) => v.trim());
  const cancelar = () => {
    if (!hayDatos) return router.back();
    decidir('¿Descartar este presupuesto?', 'Lo que escribiste no se guardará. Si quieres continuar después, guárdalo.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Guardar', onPress: () => void crear(false) },
      { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  // `abrir`: «Crear presupuesto» sigue con él (la pantalla del presupuesto). «Guardar» lo deja creado en Pendientes y vuelve a la lista, para
  // continuar después; pide lo mismo que crear (cliente con nombre y teléfono), porque un borrador sin presupuesto no existe.
  async function crear(abrir = true) {
    const tel = normalizarTelefono(telefono, codigo);
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe el nombre del cliente',
      telefono: tel ? undefined : 'Escribe un teléfono válido, con su código de país',
      correo: !correo.trim() || esCorreo(correo) ? undefined : 'Revisa el correo',
    };
    setErrores(e);
    if (e.nombre || e.telefono || e.correo) {
      if (!abrir) avisar.aviso('Falta algo para guardar', 'Escribe el nombre y el teléfono del cliente.');
      return;
    }

    setCargando(true);
    setAviso(null);
    try {
      const id = randomUUID();
      const dir = direccion.trim() || null;
      const mail = correo.trim().toLowerCase() || null;
      await guardarBorrador(borradorNuevo(id, { name: nombre.trim(), phone: tel!, email: mail, address: dir }, servicio.trim(), dir, pais, punto));
      await encolar({
        quote_id: id, method: 'POST', path: '/quotes',
        body: {
          id,
          customer: { name: nombre.trim(), phone: tel, ...(mail ? { email: mail } : {}), ...(dir ? { address: dir } : {}) },
          ...(servicio.trim() ? { service_description: servicio.trim() } : {}),
          ...(dir ? { address: dir } : {}),
          ...(punto.latitude !== null && punto.longitude !== null ? { latitude: punto.latitude, longitude: punto.longitude } : {}), // el punto del mapa, si se marcó
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (abrir) router.replace({ pathname: '/presupuesto/[id]', params: { id, nuevo: '1' } });
      else {
        router.back();
        avisar.exito('Presupuesto guardado', 'Está en Pendientes: ábrelo cuando quieras seguir.');
      }
    } catch (err) {
      setAviso(mensajeDe(err));
      avisar.error('No se pudo guardar', mensajeDe(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      {/* Hoja de iOS: la barrita de arriba avisa que se puede deslizar hacia abajo. En Android la hoja ocupa la pantalla. */}
      {Platform.OS === 'ios' ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[e.agarre, { backgroundColor: t.suave }]} /> : null}
      <View style={e.barra}>
        <IconButton icon={({ size, color }) => <Icono nombre="cerrar" tamano={size} color={color} />} iconColor={t.texto} accessibilityLabel="Cancelar" onPress={cancelar} style={e.lado} />
        <Text variant="titleMedium" accessibilityRole="header" numberOfLines={1} style={e.titulo}>Nuevo presupuesto</Text>
        <View style={e.lado} />
      </View>
      <Pasos />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={e.flex} contentContainerStyle={e.contenido}>
        <SeccionM titulo="Cliente" icono="cliente">
          <TarjetaM>
            <CampoM etiqueta="Nombre del cliente" value={nombre} onChangeText={setNombre} error={errores.nombre} autoFocus autoCapitalize="words" autoComplete="off" returnKeyType="next" />
            <CampoTelefono material codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
            <CampoM etiqueta="Correo (opcional)" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" ayuda="Con correo, el PDF se envía solo al terminar." />
          </TarjetaM>
        </SeccionM>
        <SeccionM titulo="El trabajo" icono="trabajo" descripcion="Opcional: puedes completarlo después.">
          <TarjetaM>
            <CampoM
              etiqueta="Servicio"
              value={servicio}
              onChangeText={(v) => setServicio(recortarPalabras(v, MAX_PALABRAS))}
              multiline
              ayuda={servicio.trim() ? `${palabrasDe(servicio).length} de ${MAX_PALABRAS} palabras` : 'Por ejemplo: instalar 4 enchufes en el living.'}
            />
            <CampoDireccion etiqueta="Dirección del trabajo" direccion={direccion} latitude={punto.latitude} longitude={punto.longitude} alCambiar={(d) => { setDireccion(d.direccion); setPunto({ latitude: d.latitude, longitude: d.longitude }); }} />
          </TarjetaM>
        </SeccionM>
        {aviso ? <TextoM variante="chico" color="error" accessibilityRole="alert">{aviso}</TextoM> : null}
      </ScrollView>
      {/* Las dos salidas, en un panel abajo como el de la barra del presupuesto: crear y seguir con la visita, o dejarlo en Pendientes. */}
      <View style={[e.panel, formaPanel(t.oscuro), { backgroundColor: colors.elevation.level2, paddingBottom: insets.bottom + espacio.s }]}>
        <BotonM titulo="Crear presupuesto" icono="flecha" alFinal onPress={() => void crear()} cargando={cargando} />
        <BotonM titulo="Guardar para después" variante="texto" onPress={() => void crear(false)} disabled={cargando} accessibilityLabel="Guardar el presupuesto para continuar después" />
      </View>
      <BarraListo />
      {dialogo}
    </View>
  );
}

// En qué paso va: este es el 1 de los 3 del presupuesto (CLAUDE.md §10). Al crearlo se sigue con la visita y después con los ítems.
const PASOS = ['Cliente', 'Visita', 'Presupuesto'] as const;
function Pasos() {
  const t = useTema();
  return (
    <View accessible accessibilityLabel="Paso 1 de 3: el cliente. Después siguen la visita y el presupuesto." style={e.pasos}>
      {PASOS.map((p, i) => (
        <View key={p} style={e.paso}>
          <View style={[e.rayita, { backgroundColor: i === 0 ? t.acento : t.borde }]} />
          <Text variant="labelMedium" style={i === 0 ? [e.pasoActual, { color: t.acento }] : { color: t.suave }}>{`${i + 1} · ${p}`}</Text>
        </View>
      ))}
    </View>
  );
}

// Copia local mientras el servidor no lo conoce: sin código (code_id vacío) ni número.
const borradorNuevo = (id: string, customer: { name: string; phone: string; email: string | null; address: string | null }, servicio: string, direccion: string | null, pais: Pais, punto: { latitude: number | null; longitude: number | null }): Presupuesto => ({
  id, code_id: '', number: null, doc_status: 'DRAFT', commercial_status: 'NONE',
  customer: { id: '', ...customer }, service_description: servicio, address: direccion, latitude: punto.latitude, longitude: punto.longitude,
  survey: { notes: null, measurements: [], photos: [], voice_notes: [] },
  items: [], subtotal: 0, discount: 0, include_vat: false, vat: 0, total: 0, country: pais.country, currency: pais.currency, vat_label: pais.vat_label, vat_rate: pais.vat_rate, warranty: { kind: 'NONE', text: null }, validity_days: null, next_contact_date: null, observations: null, public_url: null,
});

const e = StyleSheet.create({
  flex: { flex: 1 },
  agarre: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, opacity: 0.5, marginTop: espacio.s },
  barra: { minHeight: MIN_TOQUE + espacio.xs, flexDirection: 'row', alignItems: 'center', paddingHorizontal: espacio.xs },
  lado: { width: MIN_TOQUE, height: MIN_TOQUE, margin: 0 },
  titulo: { flex: 1, textAlign: 'center', fontWeight: '600' },
  pasos: { flexDirection: 'row', gap: 6, paddingHorizontal: espacio.l + espacio.xs, paddingTop: espacio.xs, paddingBottom: espacio.m },
  paso: { flex: 1, gap: 6 },
  rayita: { height: 4, borderRadius: 2 },
  pasoActual: { fontWeight: '600' },
  contenido: { paddingHorizontal: espacio.l, paddingBottom: espacio.xl, gap: espacio.xl },
  panel: { gap: espacio.xs, paddingTop: espacio.m, paddingHorizontal: espacio.l },
});
