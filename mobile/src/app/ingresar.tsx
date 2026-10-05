import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { Boton, Campo, Tarjeta, Texto } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
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
  const [correo, setCorreo] = useState('');
  const [canal, setCanal] = useState<Canal>('EMAIL'); // el SMS necesita Twilio (pendiente): el correo ya funciona
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [desafio, setDesafio] = useState<{ id: string; destino: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const refTelefono = useRef<TextInput>(null);
  const refCorreo = useRef<TextInput>(null);

  const telefonoE164 = normalizarTelefono(telefono, pais.calling_code);

  function continuar() {
    const e = {
      nombre: nombre.trim() ? undefined : 'Escribe tu nombre',
      telefono: telefonoE164 ? undefined : 'Escribe un teléfono válido, por ejemplo 9 1234 5678',
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
      const r = await api<{ token: string; user: Usuario }>('/auth/verify', { method: 'POST', token: null, body: { challenge_id: desafio.id, code: valor } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await iniciar(r.token, r.user); // al cambiar la sesión, el navegador pasa solo a la app
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
          <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} error={errores.nombre} autoComplete="name" textContentType="name" autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => refTelefono.current?.focus()} />
          <Campo ref={refTelefono} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="9 1234 5678" ayuda="Es tu identidad en la app." />
          <Campo ref={refCorreo} etiqueta="Correo" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="done" onSubmitEditing={continuar} />
          <Boton titulo="Continuar" onPress={continuar} />
        </Tarjeta>
      ) : null}

      {paso === 'canal' ? (
        <Tarjeta style={e.bloque}>
          <View style={[e.resumen, { backgroundColor: t.campo, borderColor: t.borde }]}>
            <Texto fuerte>{nombre.trim()}</Texto>
            <Texto suave>{telefonoE164}</Texto>
            <Texto suave>{correo.trim().toLowerCase()}</Texto>
          </View>
          <Texto variante="subtitulo">¿Dónde te enviamos el código?</Texto>
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
