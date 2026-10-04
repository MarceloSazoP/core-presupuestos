import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Texto } from '@/components/ui';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar, guardarBorrador } from '@/sync/cola';
import { espacio, useTema } from '@/theme';

// Etapa 1 del wizard (CLAUDE.md §10): cliente, ubicación y descripción inicial. Funciona sin conexión: el presupuesto
// nace en el teléfono con su propio id y se envía por la cola. El servidor entrega el código al recibirlo (sync/cola.ts).
export default function Nuevo() {
  const t = useTema();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [servicio, setServicio] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const refTelefono = useRef<TextInput>(null);
  const refCorreo = useRef<TextInput>(null);
  const refDireccion = useRef<TextInput>(null);
  const refServicio = useRef<TextInput>(null);

  async function crear() {
    const tel = normalizarTelefono(telefono);
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe el nombre del cliente',
      telefono: tel ? undefined : 'Escribe un teléfono válido, por ejemplo 9 1234 5678',
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
      await guardarBorrador(borradorNuevo(id, { name: nombre.trim(), phone: tel!, email: mail, address: dir }, servicio.trim(), dir));
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
    } finally {
      setCargando(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Campo etiqueta="Cliente" value={nombre} onChangeText={setNombre} error={errores.nombre} autoFocus autoCapitalize="words" autoComplete="off" returnKeyType="next" onSubmitEditing={() => refTelefono.current?.focus()} />
      <Campo ref={refTelefono} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} keyboardType="phone-pad" placeholder="9 1234 5678" />
      <Campo ref={refCorreo} etiqueta="Correo (opcional)" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => refDireccion.current?.focus()} ayuda="Con correo, el PDF se envía solo al terminar." />
      <Campo ref={refDireccion} etiqueta="Dirección del trabajo (opcional)" value={direccion} onChangeText={setDireccion} autoComplete="street-address" textContentType="fullStreetAddress" returnKeyType="next" onSubmitEditing={() => refServicio.current?.focus()} />
      <Campo ref={refServicio} etiqueta="¿Qué trabajo es? (opcional)" value={servicio} onChangeText={setServicio} multiline placeholder="Por ejemplo: instalar 4 enchufes en el living" />
      <View style={e.acciones}>
        {aviso ? <Texto variante="chico" color="error" accessibilityRole="alert">{aviso}</Texto> : null}
        <Boton titulo="Crear presupuesto" onPress={crear} cargando={cargando} />
      </View>
    </ScrollView>
  );
}

// Copia local mientras el servidor no lo conoce: sin código (code_id vacío) ni número.
const borradorNuevo = (id: string, customer: { name: string; phone: string; email: string | null; address: string | null }, servicio: string, direccion: string | null): Presupuesto => ({
  id, code_id: '', number: null, doc_status: 'DRAFT', commercial_status: 'NONE',
  customer: { id: '', ...customer }, service_description: servicio, address: direccion,
  survey: { notes: null, measurements: [], photos: [], voice_notes: [] },
  items: [], subtotal: 0, discount: 0, total: 0, warranty: { kind: 'NONE', text: null }, validity_days: null, next_contact_date: null, observations: null, public_url: null,
});

const e = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  acciones: { gap: espacio.m, paddingTop: espacio.s },
});
