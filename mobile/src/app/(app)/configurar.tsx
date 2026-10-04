import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { ImagenPerfil } from '@/components/imagen-perfil';
import { Boton, Campo, Segmentos, Seccion, Tarjeta, Texto } from '@/components/ui';
import { elegirTema, leerPreferenciaTema, OPCIONES_TEMA, type PreferenciaTema } from '@/lib/preferencia-tema';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// «Configurar»: los datos que salen en tus presupuestos (nombre o negocio, teléfono y correo de contacto) y tu logo. El teléfono
// y el correo con los que ingresas a la app no se cambian aquí: son tu identidad (Contrato API §4). Requiere conexión.
export default function Configurar() {
  const t = useTema();
  const { usuario, actualizar, salir } = useSesion();
  const [nombre, setNombre] = useState(usuario?.name ?? '');
  const [telefono, setTelefono] = useState(usuario?.contact_phone ?? '');
  const [correo, setCorreo] = useState(usuario?.contact_email ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tema, setTema] = useState<PreferenciaTema>('sistema');
  useEffect(() => void leerPreferenciaTema().then(setTema), []);

  // Al abrir se traen los datos frescos del servidor (los guardados en el teléfono pueden venir de otra sesión).
  useEffect(() => {
    api<Usuario>('/me')
      .then((u) => {
        setNombre(u.name);
        setTelefono(u.contact_phone ?? '');
        setCorreo(u.contact_email ?? '');
        void actualizar(u);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    const tel = telefono.trim() ? normalizarTelefono(telefono) : null;
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe tu nombre o el de tu negocio',
      telefono: telefono.trim() && !tel ? 'Escribe un teléfono válido, por ejemplo 9 1234 5678' : undefined,
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
    } catch (err) {
      setAviso({ texto: mensajeDe(err), error: true });
    } finally {
      setGuardando(false);
    }
  }

  const confirmarSalida = () =>
    Alert.alert('Cerrar sesión', `Saldrás de la cuenta de ${usuario?.name ?? 'tu usuario'}. Tus presupuestos quedan guardados.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void salir() },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Seccion titulo="Tus datos en los presupuestos" descripcion="Salen en el PDF, en el enlace que ve tu cliente y en el correo que le envías.">
        <Tarjeta>
        <Campo etiqueta="Nombre o negocio" value={nombre} onChangeText={setNombre} error={errores.nombre} autoCapitalize="words" autoComplete="name" />
        <Campo etiqueta="Teléfono de contacto" value={telefono} onChangeText={setTelefono} error={errores.telefono} keyboardType="phone-pad" placeholder={usuario?.phone ?? '9 1234 5678'} ayuda="Si lo dejas vacío se usa el de tu cuenta." />
        <Campo etiqueta="Correo de contacto" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder={usuario?.email ?? ''} ayuda="Si lo dejas vacío se usa el de tu cuenta." />
        {aviso ? <Texto variante="chico" color={aviso.error ? 'error' : 'ok'} accessibilityRole={aviso.error ? 'alert' : undefined}>{aviso.texto}</Texto> : null}
        <Boton titulo="Guardar datos" onPress={guardar} cargando={guardando} />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Apariencia" descripcion="Automático sigue el modo claro u oscuro de tu iPhone.">
        <Segmentos
          opciones={OPCIONES_TEMA}
          valor={tema}
          etiqueta="Apariencia de la app"
          alElegir={(p) => {
            setTema(p);
            void elegirTema(p);
          }}
        />
      </Seccion>

      <Tarjeta>
        <ImagenPerfil ruta="logo" titulo="Logo" nombre="el logo" ayuda="Sale arriba en tus presupuestos, en su propia fila: sirve un logo horizontal. PNG o JPEG; se ajusta solo a un tamaño liviano." vacio="Todavía no subes un logo" />
      </Tarjeta>

      <Tarjeta>
        <ImagenPerfil ruta="signature" titulo="Firma" nombre="la firma" ayuda="Se imprime sobre la línea de firma del PDF en todos tus presupuestos. Mejor sobre fondo blanco o transparente. Bajo la línea siempre salen tu nombre, teléfono y correo." vacio="Todavía no subes tu firma" />
      </Tarjeta>

      <Seccion titulo="Tu cuenta" descripcion={`Ingresas con ${usuario?.phone ?? ''} y ${usuario?.email ?? ''}. Esos datos no se cambian aquí.`}>
        <Boton titulo="Cerrar sesión" variante="secundario" onPress={confirmarSalida} />
      </Seccion>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
});
