import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mensajeDe } from '@/api/client';
import type { Cliente, Presupuesto } from '@/api/types';
import { formaPanel } from '@/components/barra-flotante';
import { BarraListo } from '@/components/barra-listo';
import { CampoTelefono } from '@/components/campo-telefono';
import { useDialogo } from '@/components/dialogo';
import { CampoDireccion } from '@/components/direccion-mapa';
import { ElegirCliente } from '@/components/elegir-cliente';
import { BotonM, CampoM, SeccionM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { clienteConTelefono } from '@/lib/buscar';
import { cargarClientes, telefonoParaCampo } from '@/lib/clientes';
import { elegirContacto, hayContactos } from '@/lib/contactos';
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
// Arriba solo la ✕ y el título; los campos se escriben ahí mismo; y abajo, en un panel, «Crear presupuesto →» (abre el presupuesto para
// seguir con la visita y los ítems) y «Guardar para después». Igual en iPhone y Android.
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

  // Tres puntos de partida (Arquitectura §5): escribirlo, elegir un cliente guardado o traerlo desde Contactos; los tres llenan este
  // mismo formulario. Con uno guardado el presupuesto queda en su ficha (`customer_id`); si se cambian su nombre, teléfono o correo,
  // pasa a ser uno nuevo. `cliente`: llega elegido desde su ficha.
  const { cliente: clienteInicial } = useLocalSearchParams<{ cliente?: string }>();
  const [guardados, setGuardados] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const llenar = (d: { nombre: string; telefono: string; correo: string; direccion?: string }) => {
    const tel = telefonoParaCampo(d.telefono, pais.calling_code);
    setNombre(d.nombre);
    setTelefono(tel.nacional);
    setCodigo(tel.codigo);
    setCorreo(d.correo);
    if (d.direccion && !direccion.trim()) setDireccion(d.direccion); // la del cliente propone la del trabajo, sin pisar una escrita
    setErrores({});
  };
  const usarCliente = (c: Cliente) => {
    llenar({ nombre: c.name, telefono: c.phone, correo: c.email ?? '', direccion: c.address ?? '' });
    setClienteId(c.id);
  };
  useEffect(() => {
    void cargarClientes().then(({ lista }) => {
      setGuardados(lista);
      const c = clienteInicial ? lista.find((x) => x.id === clienteInicial) : undefined;
      if (c) usarCliente(c);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);
  async function traerContacto() {
    const d = await elegirContacto();
    if (!d) return;
    llenar(d);
    setClienteId(null);
    void Haptics.selectionAsync();
  }
  // Cambiar un dato del cliente guardado lo vuelve uno nuevo (al crear se revisa si su teléfono ya existe).
  const dato = (set: (v: string) => void) => (v: string) => {
    set(v);
    setClienteId(null);
  };

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
  // `opcion.usar`: el cliente guardado elegido en el aviso de teléfono repetido; `opcion.nuevoIgual`: crear otro aunque el teléfono exista.
  async function crear(abrir = true, opcion: { usar?: string; nuevoIgual?: boolean } = {}) {
    const usar = opcion.usar ?? clienteId;
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
    const repetido = usar || opcion.nuevoIgual ? undefined : clienteConTelefono(guardados, tel);
    if (repetido) {
      return decidir(`Ya tienes a ${repetido.name} con ese teléfono`, '¿Usar ese cliente guardado? El presupuesto queda en su ficha.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Crear otro', onPress: () => void crear(abrir, { nuevoIgual: true }) },
        { text: 'Usar guardado', onPress: () => void crear(abrir, { usar: repetido.id }) },
      ]);
    }
    const guardado = usar ? guardados.find((c) => c.id === usar) : undefined;

    setCargando(true);
    setAviso(null);
    try {
      const id = randomUUID();
      const dir = direccion.trim() || null;
      const mail = correo.trim().toLowerCase() || null;
      // Con un cliente guardado, la copia local lleva sus datos (los de su ficha) y el servidor recibe solo su id.
      const cliente = guardado ? { id: guardado.id, name: guardado.name, phone: guardado.phone, email: guardado.email, address: guardado.address } : { id: '', name: nombre.trim(), phone: tel!, email: mail, address: dir };
      await guardarBorrador(borradorNuevo(id, cliente, servicio.trim(), dir, pais, punto));
      await encolar({
        quote_id: id, method: 'POST', path: '/quotes',
        body: {
          id,
          ...(guardado ? { customer_id: guardado.id } : { customer: { name: nombre.trim(), phone: tel, ...(mail ? { email: mail } : {}), ...(dir ? { address: dir } : {}) } }),
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
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={e.flex} contentContainerStyle={e.contenido}>
        <SeccionM titulo="Cliente" icono="cliente">
          {/* De dónde sale el cliente: uno guardado o uno de Contactos (o se escribe abajo). */}
          <View style={e.fuentes}>
            <BotonM titulo="Guardado" icono="clientes" variante="secundario" onPress={() => setEligiendo(true)} style={e.mitad} accessibilityLabel="Elegir un cliente guardado" />
            {hayContactos ? <BotonM titulo="Contactos" icono="contactos" variante="secundario" onPress={() => void traerContacto()} style={e.mitad} accessibilityLabel="Traer el cliente desde Contactos" /> : null}
          </View>
          {clienteId ? <TextoM variante="chico" color="info">Cliente guardado: el presupuesto queda en su ficha. Si cambias su nombre, teléfono o correo, se crea como uno nuevo.</TextoM> : null}
          <TarjetaM>
            <CampoM etiqueta="Nombre del cliente" value={nombre} onChangeText={dato(setNombre)} error={errores.nombre} autoFocus={!clienteInicial} autoCapitalize="words" autoComplete="off" returnKeyType="next" />
            <CampoTelefono material codigo={codigo} alCodigo={dato(setCodigo)} etiqueta="Teléfono" value={telefono} onChangeText={dato(setTelefono)} error={errores.telefono} />
            <CampoM etiqueta="Correo (opcional)" value={correo} onChangeText={dato(setCorreo)} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" ayuda="Con correo, el PDF se envía solo al terminar." />
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
      {eligiendo ? (
        <ElegirCliente
          alElegir={(c) => {
            usarCliente(c);
            setEligiendo(false);
            void Haptics.selectionAsync();
          }}
          alCerrar={() => setEligiendo(false)}
        />
      ) : null}
      {dialogo}
    </View>
  );
}

// Copia local mientras el servidor no lo conoce: sin código (code_id vacío) ni número.
const borradorNuevo = (id: string, customer: { id: string; name: string; phone: string; email: string | null; address: string | null }, servicio: string, direccion: string | null, pais: Pais, punto: { latitude: number | null; longitude: number | null }): Presupuesto => ({
  id, code_id: '', number: null, doc_status: 'DRAFT', commercial_status: 'NONE',
  customer, service_description: servicio, address: direccion, latitude: punto.latitude, longitude: punto.longitude,
  survey: { notes: null, measurements: [], photos: [], voice_notes: [] },
  items: [], subtotal: 0, discount: 0, include_vat: false, vat: 0, total: 0, country: pais.country, currency: pais.currency, vat_label: pais.vat_label, vat_rate: pais.vat_rate, warranty: { kind: 'NONE', text: null }, validity_days: null, next_contact_date: null, observations: null, public_url: null,
});

const e = StyleSheet.create({
  flex: { flex: 1 },
  agarre: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, opacity: 0.5, marginTop: espacio.s },
  barra: { minHeight: MIN_TOQUE + espacio.xs, flexDirection: 'row', alignItems: 'center', paddingHorizontal: espacio.xs },
  lado: { width: MIN_TOQUE, height: MIN_TOQUE, margin: 0 },
  titulo: { flex: 1, textAlign: 'center', fontWeight: '600' },
  contenido: { paddingHorizontal: espacio.l, paddingTop: espacio.s, paddingBottom: espacio.xl, gap: espacio.xl },
  panel: { gap: espacio.xs, paddingTop: espacio.m, paddingHorizontal: espacio.l },
  fuentes: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
});
