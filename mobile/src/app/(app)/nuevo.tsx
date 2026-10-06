import { randomUUID } from 'expo-crypto';
import { TituloConIcono } from '@/components/titulo-con-icono';
import { CampoModal } from '@/components/campo-modal';
import { avisar } from '@/lib/toast';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { BarraListo } from '@/components/barra-listo';
import { CampoTelefono } from '@/components/campo-telefono';
import { Boton, Seccion, Tarjeta, Texto } from '@/components/ui';
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
  const [servicio, setServicio] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const refTelefono = useRef<TextInput>(null);

  // Cancelar: si ya escribió algo se pregunta antes de descartar, porque el gesto de deslizar hacia abajo no avisa.
  const hayDatos = [nombre, telefono, correo, direccion, servicio].some((v) => v.trim());
  const cancelar = () => {
    if (!hayDatos) return router.back();
    Alert.alert('¿Descartar este presupuesto?', 'Lo que escribiste no se guardará.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  async function crear() {
    const tel = normalizarTelefono(telefono, codigo);
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe el nombre del cliente',
      telefono: tel ? undefined : 'Escribe un teléfono válido, con su código de país',
      correo: !correo.trim() || esCorreo(correo) ? undefined : 'Revisa el correo',
    };
    setErrores(e);
    if (e.nombre || e.telefono || e.correo) return;

    setCargando(true);
    setAviso(null);
    try {
      const id = randomUUID();
      const dir = direccion.trim() || null;
      const mail = correo.trim().toLowerCase() || null;
      await guardarBorrador(borradorNuevo(id, { name: nombre.trim(), phone: tel!, email: mail, address: dir }, servicio.trim(), dir, pais));
      await encolar({
        quote_id: id, method: 'POST', path: '/quotes',
        body: {
          id,
          customer: { name: nombre.trim(), phone: tel, ...(mail ? { email: mail } : {}), ...(dir ? { address: dir } : {}) },
          ...(servicio.trim() ? { service_description: servicio.trim() } : {}),
          ...(dir ? { address: dir } : {}),
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/presupuesto/[id]', params: { id, nuevo: '1' } });
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
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={cancelar} hitSlop={8} style={e.lado}>
            <Texto color="acento">Cancelar</Texto>
          </Pressable>
          <TituloConIcono texto="Nuevo presupuesto" icono={{ ios: 'doc.badge.plus', android: 'note_add', web: 'note_add' }} />
          <View style={e.lado} />
        </View>
      </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ flex: 1 }} contentContainerStyle={e.contenido}>
      <Seccion titulo="Cliente">
        <Tarjeta>
          <CampoModal etiqueta="Nombre" titulo="Nombre del cliente" agregar="Agregar nombre" valor={nombre} alCambiar={setNombre} error={errores.nombre} multiline={false} autoCapitalize="words" autoComplete="off" />
          <CampoTelefono ref={refTelefono} codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
          <CampoModal etiqueta="Correo (opcional)" titulo="Correo del cliente" agregar="Agregar correo" valor={correo} alCambiar={setCorreo} error={errores.correo} multiline={false} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} ayuda="Con correo, el PDF se envía solo al terminar." />
        </Tarjeta>
      </Seccion>
      <Seccion titulo="El trabajo" descripcion="Opcional: puedes completarlo después.">
        <Tarjeta>
          <CampoModal etiqueta="Servicio" titulo="Servicio" agregar="Agregar servicio" maxPalabras={69} valor={servicio} alCambiar={setServicio} placeholder="Por ejemplo: instalar 4 enchufes en el living" />
          <CampoModal etiqueta="Dirección del trabajo" titulo="Dirección" agregar="Agregar dirección" valor={direccion} alCambiar={setDireccion} multiline={false} autoComplete="street-address" textContentType="fullStreetAddress" />
        </Tarjeta>
      </Seccion>
      <View style={e.acciones}>
        {aviso ? <Texto variante="chico" color="error" accessibilityRole="alert">{aviso}</Texto> : null}
        <Boton titulo="Crear presupuesto" icono="mas" onPress={crear} cargando={cargando} />
        <Boton titulo="Cancelar" variante="texto" onPress={cancelar} disabled={cargando} />
      </View>
    </ScrollView>
    <BarraListo />
    </View>
  );
}

// Copia local mientras el servidor no lo conoce: sin código (code_id vacío) ni número.
const borradorNuevo = (id: string, customer: { name: string; phone: string; email: string | null; address: string | null }, servicio: string, direccion: string | null, pais: Pais): Presupuesto => ({
  id, code_id: '', number: null, doc_status: 'DRAFT', commercial_status: 'NONE',
  customer: { id: '', ...customer }, service_description: servicio, address: direccion,
  survey: { notes: null, measurements: [], photos: [], voice_notes: [] },
  items: [], subtotal: 0, discount: 0, include_vat: false, vat: 0, total: 0, country: pais.country, currency: pais.currency, vat_label: pais.vat_label, vat_rate: pais.vat_rate, warranty: { kind: 'NONE', text: null }, validity_days: null, next_contact_date: null, observations: null, public_url: null,
});

const e = StyleSheet.create({
  cabecera: { paddingTop: espacio.s, paddingHorizontal: espacio.l, gap: espacio.s },
  agarre: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  barra: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl, gap: espacio.xl },
  acciones: { gap: espacio.m, paddingTop: espacio.s },
});
