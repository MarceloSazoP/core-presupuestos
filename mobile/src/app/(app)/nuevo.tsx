import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { PresupuestoCreado } from '@/api/types';
import { Boton, Campo, Texto } from '@/components/ui';
import { guardarCodigo } from '@/lib/codigos';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { espacio, useTema } from '@/theme';

// Etapa 1 del wizard (CLAUDE.md §10): cliente, ubicación y descripción inicial. Al crearlo, el servidor entrega el código
// del presupuesto (una sola vez): se guarda en el teléfono y se muestra en el detalle.
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
      const q = await api<PresupuestoCreado>('/quotes', {
        method: 'POST',
        body: {
          customer: { name: nombre.trim(), phone: tel, ...(correo.trim() ? { email: correo.trim().toLowerCase() } : {}), ...(direccion.trim() ? { address: direccion.trim() } : {}) },
          ...(servicio.trim() ? { service_description: servicio.trim() } : {}),
          ...(direccion.trim() ? { address: direccion.trim() } : {}),
        },
      });
      if (q.access_code) await guardarCodigo(q.id, q.access_code);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/presupuesto/[id]', params: { id: q.id, nuevo: '1' } });
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

const e = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  acciones: { gap: espacio.m, paddingTop: espacio.s },
});
