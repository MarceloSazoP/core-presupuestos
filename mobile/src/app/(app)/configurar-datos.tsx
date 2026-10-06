import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { CampoModal } from '@/components/campo-modal';
import { CampoTelefono } from '@/components/campo-telefono';
import { Boton, Seccion, Tarjeta, Texto } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { separarTelefono } from '@/lib/paises';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { avisar } from '@/lib/toast';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// Mis datos: lo que sale en tus presupuestos (nombre o negocio, teléfono y correo de contacto). El teléfono y el correo con los que ingresas
// no se cambian aquí: son tu identidad (Contrato API §4). Requiere conexión.
export default function MisDatos() {
  const t = useTema();
  const { usuario, actualizar } = useSesion();
  const pais = usePais();
  const [nombre, setNombre] = useState(usuario?.name ?? '');
  const [telefono, setTelefono] = useState(separarTelefono(usuario?.contact_phone ?? '', pais.calling_code).nacional);
  const [codigo, setCodigo] = useState(separarTelefono(usuario?.contact_phone ?? '', pais.calling_code).codigo);
  const [correo, setCorreo] = useState(usuario?.contact_email ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Al abrir se traen los datos frescos del servidor (los guardados en el teléfono pueden venir de otra sesión).
  useEffect(() => {
    api<Usuario>('/me')
      .then((u) => {
        setNombre(u.name);
        const sep = separarTelefono(u.contact_phone ?? '', pais.calling_code);
        setTelefono(sep.nacional);
        setCodigo(sep.codigo);
        setCorreo(u.contact_email ?? '');
        void actualizar(u);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    const tel = telefono.trim() ? normalizarTelefono(telefono, codigo) : null;
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe tu nombre o el de tu negocio',
      telefono: telefono.trim() && !tel ? 'Escribe un teléfono válido, con su código de país' : undefined,
      correo: correo.trim() && !esCorreo(correo) ? 'Revisa el correo' : undefined,
    };
    setErrores(e);
    if (e.nombre || e.telefono || e.correo) return;
    setGuardando(true);
    setAviso(null);
    try {
      const u = await api<Usuario>('/me', { method: 'PUT', body: { name: nombre.trim(), contact_phone: tel, contact_email: correo.trim().toLowerCase() || null } });
      await actualizar(u);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAviso({ texto: 'Guardado. Los presupuestos que termines desde ahora llevan estos datos.', error: false });
      avisar.exito('Guardado', 'Los presupuestos que termines desde ahora llevan estos datos.');
    } catch (err) {
      setAviso({ texto: mensajeDe(err), error: true });
      avisar.error('No se pudo guardar', mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Seccion titulo="Tus datos en los presupuestos" icono="cliente" descripcion="Salen en el PDF, en el enlace que ve tu cliente y en el correo que le envías.">
        <Tarjeta>
          <CampoModal etiqueta="Nombre o negocio" titulo="Nombre o negocio" agregar="Agregar nombre" icono="cliente" valor={nombre} alCambiar={setNombre} error={errores.nombre} multiline={false} autoCapitalize="words" autoComplete="name" />
          <CampoTelefono codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono de contacto" value={telefono} onChangeText={setTelefono} error={errores.telefono} ayuda="Si lo dejas vacío se usa el de tu cuenta." />
          <CampoModal etiqueta="Correo de contacto" titulo="Correo de contacto" agregar="Agregar correo" icono="correo" valor={correo} alCambiar={setCorreo} error={errores.correo} multiline={false} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="email@email.com" ayuda="Si lo dejas vacío se usa el de tu cuenta." />
          {aviso ? <Texto variante="chico" color={aviso.error ? 'error' : 'ok'} accessibilityRole={aviso.error ? 'alert' : undefined}>{aviso.texto}</Texto> : null}
          <Boton titulo="Guardar datos" icono="guardar" onPress={guardar} cargando={guardando} />
        </Tarjeta>
      </Seccion>
    </ScrollView>
  );
}

const e = StyleSheet.create({ contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl } });
