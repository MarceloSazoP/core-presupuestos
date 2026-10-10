import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Cliente } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { useDialogo } from '@/components/dialogo';
import { BotonM, CampoM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { AvisoSinSenal } from '@/components/sincronizacion';
import { clienteConTelefono } from '@/lib/buscar';
import { cargarClientes, telefonoParaCampo } from '@/lib/clientes';
import { useSinSenal } from '@/lib/conexion';
import { elegirContacto, hayContactos } from '@/lib/contactos';
import { usePais } from '@/lib/pais-actual';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { avisar } from '@/lib/toast';
import { espacio, useTema } from '@/theme';

// Agregar un cliente (sin `id`) o corregir sus datos (con `id`): nombre, teléfono, correo y dirección, a mano o traídos desde Contactos
// con el selector del sistema (Arquitectura §5: solo el contacto que la persona elige). Requiere conexión. Al agregar uno con un teléfono
// que ya tiene otro cliente guardado, se ofrece ir a ese (el teléfono no es único: la app solo lo sugiere).
export default function EditarCliente() {
  const t = useTema();
  const pais = usePais();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sinSenal = useSinSenal();
  const { dialogo, decidir } = useDialogo();
  const [guardados, setGuardados] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState(pais.calling_code);
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [guardando, setGuardando] = useState(false);

  const llenar = (d: { nombre: string; telefono: string; correo: string; direccion: string }) => {
    const tel = telefonoParaCampo(d.telefono, pais.calling_code);
    setNombre(d.nombre);
    setTelefono(tel.nacional);
    setCodigo(tel.codigo);
    setCorreo(d.correo);
    setDireccion(d.direccion);
    setErrores({});
  };

  useEffect(() => {
    void cargarClientes().then(({ lista }) => {
      setGuardados(lista);
      const c = id ? lista.find((x) => x.id === id) : undefined;
      if (c) llenar({ nombre: c.name, telefono: c.phone, correo: c.email ?? '', direccion: c.address ?? '' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [id]);

  async function traerContacto() {
    const d = await elegirContacto();
    if (!d) return;
    llenar(d);
    void Haptics.selectionAsync();
  }

  async function guardar(aunqueExista = false) {
    const tel = normalizarTelefono(telefono, codigo);
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe el nombre del cliente',
      telefono: tel ? undefined : 'Escribe un teléfono válido, con su código de país',
      correo: !correo.trim() || esCorreo(correo) ? undefined : 'Revisa el correo',
    };
    setErrores(e);
    if (e.nombre || e.telefono || e.correo) return;
    const otro = clienteConTelefono(guardados.filter((c) => c.id !== id), tel);
    if (otro && !aunqueExista) {
      return decidir(`Ya tienes a ${otro.name} con ese teléfono`, '¿Quieres ver ese cliente en vez de crear otro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Guardar igual', onPress: () => void guardar(true) },
        { text: 'Ver cliente', onPress: () => router.replace({ pathname: '/cliente/[id]', params: { id: otro.id } }) },
      ]);
    }
    setGuardando(true);
    const datos = { name: nombre.trim(), phone: tel!, email: correo.trim().toLowerCase() || null, address: direccion.trim() || null };
    try {
      if (id) {
        await api(`/customers/${id}`, { method: 'PUT', body: datos });
        avisar.exito('Datos guardados', 'Se ven en todos sus presupuestos.');
        router.back();
      } else {
        const nuevo = await api<Cliente>('/customers', { method: 'POST', body: { id: randomUUID(), ...datos } });
        avisar.exito('Cliente agregado');
        router.replace({ pathname: '/cliente/[id]', params: { id: nuevo.id } });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      avisar.error('No se pudo guardar', mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Stack.Screen options={{ title: id ? 'Editar cliente' : 'Nuevo cliente' }} />
      {hayContactos ? <BotonM titulo="Traer desde Contactos" icono="contactos" variante="secundario" onPress={() => void traerContacto()} /> : null}
      <SeccionM titulo="Datos del cliente" icono="cliente" descripcion={id ? 'Los cambios se ven en todos sus presupuestos.' : undefined}>
        <TarjetaM>
          <CampoM etiqueta="Nombre" value={nombre} onChangeText={setNombre} error={errores.nombre} autoFocus={!id} autoCapitalize="words" autoComplete="off" returnKeyType="next" />
          <CampoTelefono material codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
          <CampoM etiqueta="Correo (opcional)" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="email@email.com" />
          <CampoM etiqueta="Dirección (opcional)" value={direccion} onChangeText={setDireccion} autoComplete="street-address" maxLength={300} placeholder="Calle y número, comuna" />
        </TarjetaM>
      </SeccionM>
      {sinSenal ? <AvisoSinSenal texto="para guardar el cliente, necesitas internet." /> : null}
      <BotonM titulo={id ? 'Guardar cambios' : 'Agregar cliente'} icono="guardar" onPress={() => void guardar()} cargando={guardando} disabled={guardando || sinSenal} />
      {id ? <TextoM variante="chico" suave>Los PDF que ya enviaste no cambian: guardan los datos con que se enviaron.</TextoM> : null}
      {dialogo}
    </ScrollView>
  );
}

const e = StyleSheet.create({ contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl } });
