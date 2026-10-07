import { randomUUID } from 'expo-crypto';
import { DireccionMapa } from '@/components/direccion-mapa';
import { TituloConIcono } from '@/components/titulo-con-icono';
import { CampoModal } from '@/components/campo-modal';
import { avisar } from '@/lib/toast';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from 'react-native-paper';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { BarraListo } from '@/components/barra-listo';
import { CampoTelefono } from '@/components/campo-telefono';
import { BotonM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar, guardarBorrador } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Etapa 1 del wizard (CLAUDE.md §10): cliente, ubicación y descripción inicial. Funciona sin conexión: el presupuesto
// nace en el teléfono con su propio id y se envía por la cola. El servidor entrega el código al recibirlo (sync/cola.ts).
import { usePais } from '@/lib/pais-actual';
import type { Pais } from '@/lib/paises';

export default function Nuevo() {
  const t = useTema();
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
  const refTelefono = useRef<TextInput>(null);

  // Cancelar: si ya escribió algo se pregunta antes de descartar, porque el gesto de deslizar hacia abajo no avisa.
  const hayDatos = [nombre, telefono, correo, direccion, servicio].some((v) => v.trim());
  const cancelar = () => {
    if (!hayDatos) return router.back();
    Alert.alert('¿Descartar este presupuesto?', 'Lo que escribiste no se guardará. Si quieres continuar después, guárdalo.', [
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
      {/* Hoja de iOS: la barrita de arriba avisa que se puede deslizar hacia abajo, y «Cancelar» es la salida visible */}
      <View style={e.cabecera}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[e.agarre, { backgroundColor: t.suave }]} />
        <View style={e.barra}>
          {/* Barra de la hoja con botones de texto de Material (onda al tocar). */}
          <Button mode="text" onPress={cancelar} textColor={t.acento} accessibilityLabel="Cancelar" style={e.lado} contentStyle={e.ladoContenido} labelStyle={e.textoLado}>
            Cancelar
          </Button>
          <TituloConIcono texto="Nuevo presupuesto" icono={{ ios: 'doc.badge.plus', android: 'note_add', web: 'note_add' }} />
          <Button mode="text" onPress={() => void crear(false)} disabled={cargando} textColor={t.acento} accessibilityLabel="Guardar el presupuesto para continuar después" style={e.lado} contentStyle={e.ladoContenido} labelStyle={[e.textoLado, e.fuerte]}>
            Guardar
          </Button>
        </View>
      </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ flex: 1 }} contentContainerStyle={e.contenido}>
      <SeccionM titulo="Cliente" icono="cliente">
        <TarjetaM>
          <CampoModal etiqueta="Nombre" titulo="Nombre del cliente" agregar="Agregar nombre" icono="cliente" valor={nombre} alCambiar={setNombre} error={errores.nombre} multiline={false} autoCapitalize="words" autoComplete="off" />
          <CampoTelefono ref={refTelefono} codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
          <CampoModal etiqueta="Correo (opcional)" titulo="Correo del cliente" agregar="Agregar correo" icono="correo" valor={correo} alCambiar={setCorreo} error={errores.correo} multiline={false} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} ayuda="Con correo, el PDF se envía solo al terminar." />
        </TarjetaM>
      </SeccionM>
      <SeccionM titulo="El trabajo" icono="trabajo" descripcion="Opcional: puedes completarlo después.">
        <TarjetaM>
          <CampoModal etiqueta="Servicio" titulo="Servicio" agregar="Agregar servicio" icono="trabajo" maxPalabras={69} valor={servicio} alCambiar={setServicio} placeholder="Por ejemplo: instalar 4 enchufes en el living" />
          <DireccionMapa etiqueta="Dirección del trabajo" direccion={direccion} latitude={punto.latitude} longitude={punto.longitude} alCambiar={(d) => { setDireccion(d.direccion); setPunto({ latitude: d.latitude, longitude: d.longitude }); }} />
        </TarjetaM>
      </SeccionM>
      <View style={e.acciones}>
        {aviso ? <TextoM variante="chico" color="error" accessibilityRole="alert">{aviso}</TextoM> : null}
        <BotonM titulo="Crear presupuesto" icono="mas" onPress={() => void crear()} cargando={cargando} />
        <BotonM titulo="Cancelar" variante="texto" onPress={cancelar} disabled={cargando} />
      </View>
    </ScrollView>
    <BarraListo />
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
  cabecera: { paddingTop: espacio.s, paddingHorizontal: espacio.l, gap: espacio.s },
  agarre: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  barra: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lado: { minWidth: 88, borderRadius: 999 },
  ladoContenido: { minHeight: MIN_TOQUE },
  textoLado: { fontSize: 16, marginHorizontal: 12 },
  fuerte: { fontWeight: '700' },
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl, gap: espacio.xl },
  acciones: { gap: espacio.m, paddingTop: espacio.s },
});
