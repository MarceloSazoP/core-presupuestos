import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { Boton, Campo, Tarjeta, Texto } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { esCorreo, formatearTelefono, normalizarTelefono } from '@/lib/telefono';
import { cargarUltimoAcceso, olvidarAcceso, recordarAcceso } from '@/lib/ultimo-acceso';
import { useSesion } from '@/session';
import { espacio, MIN_TOQUE, radio, useTema } from '@/theme';

// Onboarding (CLAUDE.md §17): datos → confirmar y elegir SMS o correo → recibir y validar el código → entrar.
type Paso = 'datos' | 'canal' | 'codigo';
type Canal = 'SMS' | 'EMAIL';
const PASOS: Paso[] = ['datos', 'canal', 'codigo'];

export default function Ingresar() {
  const pais = usePais(); // sin cuenta todavía: el de la región del teléfono, si escribe el número sin prefijo
  const t = useTema();
  const { iniciar } = useSesion();
  const [paso, setPaso] = useState<Paso>('datos');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [prefijo, setPrefijo] = useState(pais.calling_code); // el país del número que se escribe (propuesto: el de la región del teléfono)
  const [correo, setCorreo] = useState('');
  const [canal, setCanal] = useState<Canal>('EMAIL'); // el SMS necesita Twilio (pendiente): el correo ya funciona
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [desafio, setDesafio] = useState<{ id: string; destino: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const refTelefono = useRef<TextInput>(null);
  // Los datos de la última vez se sugieren ya escritos; «Recordar mis datos» los guarda en este teléfono para la próxima.
  const [recordar, setRecordar] = useState(true);
  const [sugeridos, setSugeridos] = useState(false);
  useEffect(() => {
    void cargarUltimoAcceso().then((d) => {
      if (!d) return;
      setPrefijo(d.prefijo);
      setTelefono(formatearTelefono(d.telefono, d.prefijo));
      setCorreo(d.correo);
      setNombre(d.nombre);
      setSugeridos(true);
    });
  }, []);
  const otrosDatos = () => {
    setTelefono('');
    setCorreo('');
    setNombre('');
    setSugeridos(false);
    void olvidarAcceso();
  };
  const refCorreo = useRef<TextInput>(null);

  const telefonoE164 = normalizarTelefono(telefono, prefijo);

  function continuar() {
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe tu nombre',
      telefono: telefonoE164 ? undefined : 'Escribe un teléfono válido, con su código de país',
      correo: esCorreo(correo) ? undefined : 'Escribe un correo válido',
    };
    setErrores(e);
    if (!e.nombre && !e.telefono && !e.correo) {
      setAviso(null);
      setPaso('canal');
    }
  }

  async function enviarCodigo() {
    setCargando(true);
    setAviso(null);
    try {
      const r = await api<{ challenge_id: string; destination_masked: string }>('/auth/start', {
        method: 'POST', token: null,
        body: { phone: telefonoE164, name: nombre.trim(), email: correo.trim().toLowerCase(), channel: canal },
      });
      setDesafio({ id: r.challenge_id, destino: r.destination_masked });
      setCodigo('');
      setPaso('codigo');
    } catch (e) {
      setAviso(mensajeDe(e));
    } finally {
      setCargando(false);
    }
  }

  async function verificar(valor: string) {
    if (!desafio || cargando) return;
    setCargando(true);
    setAviso(null);
    try {
      const r = await api<{ token: string; user: Usuario; is_new_user?: boolean }>('/auth/verify', { method: 'POST', token: null, body: { challenge_id: desafio.id, code: valor } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (recordar) await recordarAcceso({ prefijo, telefono, correo: correo.trim().toLowerCase(), nombre: nombre.trim() });
      else await olvidarAcceso();
      await iniciar(r.token, r.user); // al cambiar la sesión, el navegador pasa solo a la app
      if (r.is_new_user) Alert.alert('Revisa tu correo', `Te enviamos a ${r.user.email} un QR de recuperación. Guárdalo: sirve para volver a entrar si pierdes o cambias de teléfono, aunque no recuerdes el número.`);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAviso(mensajeDe(e));
      setCodigo('');
    } finally {
      setCargando(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <View style={e.encabezado}>
        <Image source={require('../../assets/images/marca.png')} accessibilityLabel="Logo de CORE Presupuestos" style={e.marca} contentFit="contain" />
        <Texto variante="titulo">CORE Presupuestos</Texto>
        <Texto suave>No olvides nada de lo que viste en terreno.</Texto>
      </View>

      {/* Tres pasos de verdad (datos → canal → código): el número dice dónde vas. */}
      <View accessibilityLabel={`Paso ${PASOS.indexOf(paso) + 1} de 3`} style={e.pasos}>
        {PASOS.map((p, i) => (
          <View key={p} style={[e.paso, { backgroundColor: i <= PASOS.indexOf(paso) ? t.acento : t.borde }]} />
        ))}
      </View>

      {paso === 'datos' ? (
        <Tarjeta style={e.bloque}>
          <Texto variante="subtitulo">Tus datos</Texto>
          {sugeridos ? (
            <View style={e.sugerencia}>
              <Texto variante="chico" suave style={e.flexTexto}>Escribimos los datos con que entraste la última vez. Si son otros, cámbialos.</Texto>
              <Pressable accessibilityRole="button" accessibilityLabel="Borrar los datos recordados y escribir otros" onPress={otrosDatos} hitSlop={8} style={e.otros}>
                <Texto color="acento" fuerte>Usar otros datos</Texto>
              </Pressable>
            </View>
          ) : null}
          <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} error={errores.nombre} autoComplete="name" textContentType="name" autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => refTelefono.current?.focus()} />
          <CampoTelefono ref={refTelefono} codigo={prefijo} alCodigo={setPrefijo} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} textContentType="telephoneNumber" ayuda="Es tu identidad en la app." />
          <Campo ref={refCorreo} etiqueta="Correo" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="done" onSubmitEditing={continuar} />
          <View style={e.recordar}>
            <View style={e.flexTexto}>
              <Texto>Recordar mis datos en este teléfono</Texto>
              <Texto variante="chico" suave>Así la próxima vez no tendrás que escribirlos.</Texto>
            </View>
            <Switch accessibilityLabel="Recordar mis datos en este teléfono" value={recordar} onValueChange={setRecordar} trackColor={{ true: t.acento }} />
          </View>
          <Boton titulo="Continuar" onPress={continuar} />
          <Boton titulo="Entrar con el QR de mi correo" variante="texto" onPress={() => router.push('/recuperar')} />
        </Tarjeta>
      ) : null}

      {paso === 'canal' ? (
        <Tarjeta style={e.bloque}>
          <View style={[e.resumen, { backgroundColor: t.campo, borderColor: t.borde }]}>
            <Texto fuerte>{nombre.trim()}</Texto>
            <Texto suave>{telefonoE164}</Texto>
            <Texto suave>{correo.trim().toLowerCase()}</Texto>
          </View>
          <Texto variante="subtitulo">¿Son correctos tu teléfono y tu correo?</Texto>
          <Texto variante="chico" suave>Si es tu primera vez, te enviaremos a este correo un QR para recuperar tu cuenta si pierdes o cambias de teléfono. Revísalos bien.</Texto>
          <Texto fuerte>¿Dónde te enviamos el código?</Texto>
          {(['EMAIL', 'SMS'] as const).map((c) => {
            const elegido = canal === c;
            return (
              <Pressable key={c} accessibilityRole="radio" accessibilityState={{ selected: elegido }} onPress={() => setCanal(c)} style={[e.opcion, { borderColor: elegido ? t.acento : t.bordeCampo, backgroundColor: elegido ? `${t.acento}14` : t.campo }]}>
                <View style={[e.radio, { borderColor: elegido ? t.acento : t.suave }]}>{elegido ? <View style={[e.radioDentro, { backgroundColor: t.acento }]} /> : null}</View>
                <View style={e.opcionTexto}>
                  <Texto fuerte>{c === 'SMS' ? 'SMS' : 'Correo'}</Texto>
                  <Texto variante="chico" suave>{c === 'SMS' ? telefonoE164 : correo.trim().toLowerCase()}</Texto>
                </View>
              </Pressable>
            );
          })}
          {aviso ? <Texto variante="chico" color="error" accessibilityRole="alert">{aviso}</Texto> : null}
          <Boton titulo="Enviar código" onPress={enviarCodigo} cargando={cargando} />
          <Boton titulo="Corregir mis datos" variante="texto" onPress={() => setPaso('datos')} />
        </Tarjeta>
      ) : null}

      {paso === 'codigo' && desafio ? (
        <Tarjeta style={e.bloque}>
          <Texto>
            Enviamos un código de 6 dígitos a <Texto fuerte>{desafio.destino}</Texto>. Vale 10 minutos.
          </Texto>
          <Campo
            etiqueta="Código"
            value={codigo}
            onChangeText={(v) => {
              const limpio = v.replace(/\D/g, '').slice(0, 6);
              setCodigo(limpio);
              if (limpio.length === 6) void verificar(limpio); // se envía solo al completar los 6 dígitos
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            autoFocus
            style={e.codigo}
            editable={!cargando}
          />
          {aviso ? <Texto variante="chico" color="error" accessibilityRole="alert">{aviso}</Texto> : null}
          <Boton titulo="Entrar" onPress={() => void verificar(codigo)} cargando={cargando} disabled={codigo.length !== 6} />
          <Boton titulo="Reenviar o cambiar el canal" variante="texto" onPress={() => { setAviso(null); setPaso('canal'); }} />
        </Tarjeta>
      ) : null}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  sugerencia: { gap: espacio.xs },
  flexTexto: { flex: 1 },
  otros: { minHeight: MIN_TOQUE, justifyContent: 'center', alignSelf: 'flex-start' },
  recordar: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  contenido: { padding: espacio.l, gap: espacio.xl },
  encabezado: { gap: espacio.xs, paddingTop: espacio.xl, paddingHorizontal: espacio.s },
  marca: { width: 72, height: 64, marginBottom: espacio.m },
  pasos: { flexDirection: 'row', gap: espacio.s, paddingHorizontal: espacio.s },
  paso: { flex: 1, height: 4, borderRadius: 2 },
  bloque: { gap: espacio.l, padding: espacio.xl },
  resumen: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.l, gap: espacio.xs },
  opcion: { minHeight: MIN_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1.5, borderRadius: radio.m, borderCurve: 'continuous', padding: espacio.l },
  opcionTexto: { flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDentro: { width: 10, height: 10, borderRadius: 5 },
  codigo: { fontSize: 28, lineHeight: 34, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
