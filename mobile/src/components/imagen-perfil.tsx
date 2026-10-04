import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Keyboard, StyleSheet, Switch, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { api, fuenteDeArchivo, mensajeDe, subir } from '@/api/client';
import type { Usuario } from '@/api/types';
import { Boton, Texto } from '@/components/ui';
import { prepararLogo } from '@/lib/foto';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// Logo o firma del perfil (Contrato API §4): vista previa de la imagen ACTUAL, elegir/cambiar y quitar. Al cambiarla pasa un
// destello verde que dice «Actualizado». La dirección de la imagen lleva el id del archivo (`logo_id` / `signature_id`), que
// cambia con cada imagen nueva: así nunca se ve una vieja guardada en caché.
type Props = { ruta: 'logo' | 'signature'; titulo: string; ayuda: string; vacio: string; nombre: string };

export function ImagenPerfil({ ruta, titulo, ayuda, vacio, nombre }: Props) {
  const t = useTema();
  const { usuario, actualizar } = useSesion();
  const [ocupado, setOcupado] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [mensaje, setMensaje] = useState('Actualizado');
  const destello = useSharedValue(0);
  const estiloDestello = useAnimatedStyle(() => ({ opacity: destello.get() }));

  const tiene = ruta === 'logo' ? !!usuario?.has_logo : !!usuario?.has_signature;
  const id = ruta === 'logo' ? usuario?.logo_id : usuario?.signature_id;

  // Sube rápido, se queda un momento y se apaga despacio.
  const encender = (texto: string) => {
    setMensaje(texto);
    destello.set(withSequence(withTiming(1, { duration: 160 }), withDelay(1200, withTiming(0, { duration: 500 }))));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Solo la firma: incluirla es una opción del perfil (Contrato API §4), no de cada presupuesto: o va en todos o en ninguno.
  async function incluir(valor: boolean) {
    setCambiando(true);
    try {
      await actualizar(await api<Usuario>('/me', { method: 'PUT', body: { include_signature: valor } }));
      encender('Actualizado');
    } catch (err) {
      Alert.alert('No se pudo cambiar', mensajeDe(err));
    } finally {
      setCambiando(false);
    }
  }

  async function elegir() {
    Keyboard.dismiss(); // con el teclado abierto, el selector descuadra el espacio de abajo
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled || !usuario) return;
    const a = r.assets[0]!;
    setOcupado(true);
    try {
      const uri = await prepararLogo(a.uri, a.width, a.height); // PNG liviano con su transparencia
      // La respuesta es el perfil con el id nuevo, que cambia la dirección de la imagen y rompe la caché.
      await actualizar(await subir<Usuario>(`/me/${ruta}`, { uri, name: `${ruta}.png`, type: 'image/png' }, {}, 'PUT'));
      encender('Actualizado');
    } catch (err) {
      Alert.alert(`No se pudo guardar ${nombre}`, mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  }

  const quitar = () =>
    Alert.alert(`¿Quitar ${nombre}?`, 'Los presupuestos que ya enviaste la conservan; los nuevos saldrán sin ella.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          setOcupado(true);
          api(`/me/${ruta}`, { method: 'DELETE' })
            .then(() => {
              if (usuario) void actualizar(ruta === 'logo' ? { ...usuario, has_logo: false, logo_id: null } : { ...usuario, has_signature: false, signature_id: null, include_signature: false });
              encender('Quitado');
            })
            .catch((err) => Alert.alert(`No se pudo quitar ${nombre}`, mensajeDe(err)))
            .finally(() => setOcupado(false));
        },
      },
    ]);

  return (
    <View style={e.seccion}>
      <Texto variante="subtitulo">{titulo}</Texto>
      <Texto variante="chico" suave>{ayuda}</Texto>
      <View style={[e.vista, { backgroundColor: tiene ? '#FFFFFF' : t.tarjeta, borderColor: t.borde }]}>
        {tiene ? (
          <Image source={fuenteDeArchivo(`/me/${ruta}?v=${id ?? 'sin-id'}`)} contentFit="contain" accessibilityLabel={titulo} style={e.imagen} />
        ) : (
          <Texto variante="chico" suave>{vacio}</Texto>
        )}
        {/* Destello verde al cambiar: solo se ve un instante y no recibe toques */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, e.destello, { backgroundColor: `${t.ok}40`, borderColor: t.ok }, estiloDestello]}>
          <View style={[e.etiqueta, { backgroundColor: t.ok }]}>
            <Texto variante="chico" fuerte color="sobreAcento">{mensaje} ✓</Texto>
          </View>
        </Animated.View>
      </View>
      {ruta === 'signature' ? (
        <>
          <View style={e.filaSwitch}>
            <Texto style={e.textoSwitch}>Incluir mi firma en todos mis presupuestos</Texto>
            <Switch accessibilityLabel="Incluir mi firma en todos mis presupuestos" value={tiene && !!usuario?.include_signature} disabled={!tiene || cambiando} onValueChange={(v) => void incluir(v)} trackColor={{ true: t.acento }} />
          </View>
          <Texto variante="chico" suave>{tiene ? 'Activada, la firma sale en todos los presupuestos que termines; apagada, no sale en ninguno. El nombre, el teléfono y el correo siempre salen bajo la línea de firma.' : 'Sube tu firma para poder activarla.'}</Texto>
        </>
      ) : null}
      <Boton titulo={tiene ? `Cambiar ${nombre}` : `Elegir ${nombre}`} variante="secundario" onPress={() => void elegir()} cargando={ocupado} />
      {tiene ? <Boton titulo={`Quitar ${nombre}`} variante="texto" onPress={quitar} disabled={ocupado} /> : null}
    </View>
  );
}

const e = StyleSheet.create({
  seccion: { gap: espacio.m },
  vista: { height: 120, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imagen: { width: '100%', height: '100%' },
  filaSwitch: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  textoSwitch: { flex: 1 },
  destello: { borderWidth: 2, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: espacio.s },
  etiqueta: { borderRadius: 999, paddingHorizontal: espacio.m, paddingVertical: espacio.xs },
});
