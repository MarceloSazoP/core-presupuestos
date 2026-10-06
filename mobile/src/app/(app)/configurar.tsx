import * as Haptics from 'expo-haptics';
import { PestanasParte } from '@/components/pestanas-parte';
import Constants from 'expo-constants';
import { CampoModal } from '@/components/campo-modal';
import { avisar } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { ElegirPais } from '@/components/elegir-pais';
import { ImagenPerfil } from '@/components/imagen-perfil';
import { Boton, Icono, Presionable, Seccion, Tarjeta, Texto, type NombreIcono } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { bandera, separarTelefono } from '@/lib/paises';
import { elegirTema, leerPreferenciaTema, OPCIONES_TEMA, type PreferenciaTema } from '@/lib/preferencia-tema';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// «Configurar»: los datos que salen en tus presupuestos (nombre o negocio, teléfono y correo de contacto) y tu logo. El teléfono
// y el correo con los que ingresas a la app no se cambian aquí: son tu identidad (Contrato API §4). Requiere conexión.
export default function Configurar() {
  const t = useTema();
  const { usuario, actualizar, salir } = useSesion();
  const pais = usePais();
  const [nombre, setNombre] = useState(usuario?.name ?? '');
  const [telefono, setTelefono] = useState(separarTelefono(usuario?.contact_phone ?? '', pais.calling_code).nacional);
  const [codigo, setCodigo] = useState(separarTelefono(usuario?.contact_phone ?? '', pais.calling_code).codigo);
  const [correo, setCorreo] = useState(usuario?.contact_email ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tema, setTema] = useState<PreferenciaTema>('sistema');
  const [eligiendoPais, setEligiendoPais] = useState(false);
  const [parte, setParte] = useState<'datos' | 'imagenes' | 'info'>('datos'); // tres pestañas: tus datos, el logo y la firma, y la información de la app
  async function cambiarPais(country: string) {
    setEligiendoPais(false);
    if (country === pais.country) return;
    try {
      void actualizar(await api<Usuario>('/me', { method: 'PUT', body: { country } }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      avisar.error('No se pudo cambiar el país', mensajeDe(err));
    }
  }
  useEffect(() => void leerPreferenciaTema().then(setTema), []);

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

  const [enviandoQr, setEnviandoQr] = useState(false);
  async function enviarQr() {
    setEnviandoQr(true);
    try {
      const r = await api<{ destination_masked: string }>('/me/recovery-qr', { method: 'POST' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      avisar.exito('Te lo enviamos', `Llegará a ${r.destination_masked}. El QR anterior ya no sirve.`);
    } catch (err) {
      avisar.error('No se pudo enviar el QR', mensajeDe(err));
    } finally {
      setEnviandoQr(false);
    }
  }

  const confirmarSalida = () =>
    Alert.alert('Cerrar sesión', `Saldrás de la cuenta de ${usuario?.name ?? 'tu usuario'}. Tus presupuestos quedan guardados.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void salir() },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <PestanasParte
        partes={[{ id: 'datos', texto: 'Mis datos', icono: 'cliente' }, { id: 'imagenes', texto: 'Logo y firma', icono: 'galeria' }, { id: 'info', texto: 'Información', icono: 'info' }]}
        valor={parte}
        alElegir={(id) => setParte(id as 'datos' | 'imagenes' | 'info')}
        etiqueta="Secciones de configuración"
      />

      {parte === 'datos' ? (
        <>
      <Seccion titulo="Apariencia" descripcion="Automático sigue el modo claro u oscuro de tu iPhone.">
        <PestanasParte
          partes={OPCIONES_TEMA.map((o) => ({ id: o.id, texto: o.texto, icono: ICONO_TEMA[o.id] }))}
          valor={tema}
          etiqueta="Apariencia de la app"
          alElegir={(id) => {
            const p = id as PreferenciaTema;
            setTema(p);
            void elegirTema(p);
          }}
        />
      </Seccion>

      <Seccion titulo="País" descripcion="Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian.">
        <Tarjeta style={e.tarjetaPais}>
          <Presionable accessibilityRole="button" accessibilityLabel={`País: ${pais.name}. Cambiar`} onPress={() => setEligiendoPais(true)} estilo={e.filaPais}>
            <View style={e.flexPais}>
              <Texto fuerte>{bandera(pais.country)} {pais.name}</Texto>
              <Texto variante="chico" suave>{pais.currency} · {pais.vat_label} {pais.vat_rate} %</Texto>
            </View>
            <Icono nombre="despliegue" tamano={12} color={t.suave} />
          </Presionable>
        </Tarjeta>
      </Seccion>
      {eligiendoPais ? <ElegirPais titulo="País" nota="Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian." detalle={(p) => `${p.currency} · ${p.vat_label} ${p.vat_rate} %`} actual={pais.country} alElegir={(c) => void cambiarPais(c)} alCerrar={() => setEligiendoPais(false)} /> : null}

      <Seccion titulo="Tus datos en los presupuestos" descripcion="Salen en el PDF, en el enlace que ve tu cliente y en el correo que le envías.">
        <Tarjeta>
        <CampoModal etiqueta="Nombre o negocio" titulo="Nombre o negocio" agregar="Agregar nombre" valor={nombre} alCambiar={setNombre} error={errores.nombre} multiline={false} autoCapitalize="words" autoComplete="name" />
        <CampoTelefono codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono de contacto" value={telefono} onChangeText={setTelefono} error={errores.telefono} ayuda="Si lo dejas vacío se usa el de tu cuenta." />
        <CampoModal etiqueta="Correo de contacto" titulo="Correo de contacto" agregar="Agregar correo" valor={correo} alCambiar={setCorreo} error={errores.correo} multiline={false} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="email@email.com" ayuda="Si lo dejas vacío se usa el de tu cuenta." />
        {aviso ? <Texto variante="chico" color={aviso.error ? 'error' : 'ok'} accessibilityRole={aviso.error ? 'alert' : undefined}>{aviso.texto}</Texto> : null}
        <Boton titulo="Guardar datos" icono="guardar" onPress={guardar} cargando={guardando} />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Tu cuenta" descripcion={`Ingresas con ${usuario?.phone ?? ''} y ${usuario?.email ?? ''}. Esos datos no se cambian aquí.`}>
        <Boton titulo="Enviar QR de recuperación a mi correo" icono="qr" icono2="correo" colorIcono={t.acento} variante="secundario" onPress={() => void enviarQr()} cargando={enviandoQr} />
        <Texto variante="chico" suave>Sirve para volver a entrar si pierdes o cambias de teléfono, aunque no recuerdes el número. Pedir uno nuevo deja sin efecto el anterior.</Texto>
        <Boton titulo="Cerrar sesión" icono="salir" colorIcono={t.error} variante="secundario" onPress={confirmarSalida} />
      </Seccion>
        </>
      ) : parte === 'imagenes' ? (
        <>
      <Tarjeta>
        <ImagenPerfil ruta="logo" titulo="Logo" nombre="el logo" ayuda="Sale arriba en tus presupuestos, en su propia fila: sirve un logo horizontal. PNG o JPEG; se ajusta solo a un tamaño liviano." vacio="Todavía no subes un logo" />
      </Tarjeta>

      <Tarjeta>
        <ImagenPerfil ruta="signature" titulo="Firma" nombre="la firma" ayuda="Se imprime sobre la línea de firma del PDF en todos tus presupuestos. Mejor sobre fondo blanco o transparente. Bajo la línea siempre salen tu nombre, teléfono y correo." vacio="Todavía no subes tu firma" />
      </Tarjeta>

        </>
      ) : (
        <>
      {/* Acerca de: la versión de la app y quién la creó. */}
      <Seccion titulo="Acerca de" icono="info">
        <Tarjeta>
          <View style={e.filaInfo}>
            <Texto suave>Versión</Texto>
            <Texto fuerte style={e.versionNumero}>{Constants.expoConfig?.version ?? '—'}</Texto>
          </View>
          <View style={[e.filaInfo, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde, paddingTop: espacio.m }]}>
            <Texto suave>Creada por</Texto>
            <Texto fuerte style={e.derechaTexto}>CORE Tecnología Empresarial</Texto>
          </View>
          <View style={[e.filaInfo, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde, paddingTop: espacio.m }]}>
            <Texto suave>Año</Texto>
            <Texto fuerte style={e.versionNumero}>{AÑO_DE_CREACION}</Texto>
          </View>
        </Tarjeta>
      </Seccion>
        </>
      )}
    </ScrollView>
  );
}

const AÑO_DE_CREACION = 2026;
const ICONO_TEMA: Record<PreferenciaTema, NombreIcono> = { sistema: 'sistema', claro: 'sol', oscuro: 'luna' };

const e = StyleSheet.create({
  filaInfo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espacio.m },
  versionNumero: { fontVariant: ['tabular-nums'] },
  derechaTexto: { flexShrink: 1, textAlign: 'right' },
  tarjetaPais: { padding: 0 },
  filaPais: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l },
  flexPais: { flex: 1 },
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
});
