import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { BarraListo } from '@/components/barra-listo';
import { useDialogo } from '@/components/dialogo';
import { Boton, Campo, Texto } from '@/components/ui';
import { tokenDeRecuperacion } from '@/lib/recuperacion';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// «Entrar con el QR de mi correo» (Recuperación de cuenta con QR.md): en un teléfono nuevo, sin recordar el número. Se lee el QR que
// llegó al correo al registrarse (o se escribe su código) y se entra a la cuenta; el QR queda usado y llega el siguiente al correo.
export default function Recuperar() {
  const t = useTema();
  const { iniciar } = useSesion();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { dialogo, decidir } = useDialogo();
  const [escribiendo, setEscribiendo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ocupado = useRef(false); // la cámara dispara varias lecturas del mismo QR

  async function entrar(leido: string) {
    if (ocupado.current) return;
    ocupado.current = true;
    const token = tokenDeRecuperacion(leido);
    if (!token) {
      decidir('Ese no es el QR de recuperación', 'Usa el QR que te llegó por correo al registrarte (o el último que te enviamos).', [{ text: 'Entendido', onPress: () => (ocupado.current = false) }]);
      return;
    }
    setEntrando(true);
    setAviso(null);
    try {
      const r = await api<{ token: string; user: Usuario }>('/auth/recovery', { method: 'POST', token: null, body: { token, close_other_sessions: true } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await iniciar(r.token, r.user); // al cambiar la sesión, el navegador pasa solo a la app
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const invalido = err instanceof ApiError && err.status === 401;
      setAviso(invalido ? 'Ese QR ya se usó o no es válido.' : null);
      decidir(
        invalido ? 'Ese QR ya no sirve' : 'No se pudo entrar',
        invalido ? 'Se usa una sola vez. Busca en tu correo el último que te enviamos, o entra con tu teléfono y pide uno nuevo en Configurar.' : mensajeDe(err),
        [{ text: 'Entendido', onPress: () => (ocupado.current = false) }],
      );
      setEntrando(false);
    }
  }

  // Sin permiso de cámara (y sin poder pedirlo) o por elección, se escribe el código.
  if (escribiendo || (permiso && !permiso.granted && !permiso.canAskAgain)) {
    return (
      <View style={[e.centro, { backgroundColor: t.fondo }]}>
        <Texto variante="subtitulo" style={e.texto}>Escribe el código</Texto>
        <Texto suave style={e.texto}>Es el código largo que viene en el correo, debajo de «pega este código».</Texto>
        <Campo etiqueta="Código del correo" value={codigo} onChangeText={setCodigo} autoCapitalize="none" autoCorrect={false} multiline error={aviso} />
        <Boton titulo="Entrar" onPress={() => void entrar(codigo)} cargando={entrando} disabled={!codigo.trim()} />
        {permiso?.canAskAgain !== false ? <Boton titulo="Mejor leo el QR con la cámara" variante="texto" onPress={() => setEscribiendo(false)} /> : null}
        <Boton titulo="Volver" variante="texto" onPress={() => router.back()} />
        <BarraListo />
        {dialogo}
      </View>
    );
  }
  if (!permiso) return <View style={[e.centro, { backgroundColor: t.fondo }]} />;
  if (!permiso.granted) {
    return (
      <View style={[e.centro, { backgroundColor: t.fondo }]}>
        <Texto variante="subtitulo" style={e.texto}>Necesitamos la cámara</Texto>
        <Texto suave style={e.texto}>Solo para leer el QR que te llegó por correo. No se guarda ninguna imagen.</Texto>
        <Boton titulo="Permitir la cámara" onPress={() => void pedirPermiso()} />
        <Boton titulo="Mejor escribo el código" variante="texto" onPress={() => setEscribiendo(true)} />
        <Boton titulo="Volver" variante="texto" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={e.camara}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={entrando ? undefined : ({ data }) => void entrar(data)} />
      <View style={e.guia} pointerEvents="none">
        <View style={e.marco} />
      </View>
      <View style={[e.pie, { backgroundColor: t.fondo }]}>
        <Texto variante="subtitulo" style={e.texto} accessibilityLiveRegion="polite">{entrando ? 'Entrando…' : 'Apunta al QR de tu correo'}</Texto>
        <Texto suave variante="chico" style={e.texto}>Es el que te enviamos al registrarte. Ábrelo en el computador u otra pantalla.</Texto>
        <Boton titulo="Escribir el código" variante="secundario" onPress={() => setEscribiendo(true)} disabled={entrando} />
        <Boton titulo="Volver" variante="texto" onPress={() => router.back()} disabled={entrando} />
      </View>
      {dialogo}
    </View>
  );
}

const e = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: espacio.xl, gap: espacio.l },
  texto: { textAlign: 'center' },
  camara: { flex: 1, backgroundColor: '#000' },
  guia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 200 },
  marco: { width: 240, height: 240, borderWidth: 4, borderColor: '#fff', borderRadius: 24, borderCurve: 'continuous' },
  pie: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: espacio.xl, paddingBottom: espacio.xxl, gap: espacio.s, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: 'continuous' },
});
