import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ApiError, api, mensajeDe } from '@/api/client';
import { useDialogo } from '@/components/dialogo';
import { BotonM, TextoM } from '@/components/material';
import { codigoDeVinculo } from '@/lib/vinculo';
import { asegurarSincronizado } from '@/sync/cola';
import { espacio, useTema } from '@/theme';

// «Ver en la web» (Mecanismo de consulta, v1.3): se escanea el QR de la portada y el presupuesto se abre en ese computador.
// Se pide confirmar antes de vincular, para no abrir un presupuesto en un computador ajeno por escanear un QR sin querer.
export default function Escanear() {
  const t = useTema();
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo: string }>();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { dialogo, decidir } = useDialogo();
  const [estado, setEstado] = useState<'buscando' | 'vinculando' | 'listo'>('buscando');
  const ocupado = useRef(false); // la cámara dispara varias lecturas del mismo QR

  async function alLeer(leido: string) {
    if (ocupado.current) return;
    const codigo = codigoDeVinculo(leido);
    ocupado.current = true;
    void Haptics.selectionAsync();
    const seguir = () => {
      ocupado.current = false;
      setEstado('buscando');
    };
    if (!codigo) return decidir('Ese QR no es de CorePresupuesto', 'Escanea el QR de la portada de la web de CorePresupuesto.', [{ text: 'Entendido', onPress: seguir }]);
    decidir('¿Abrir en el computador?', `${titulo} se abrirá en el computador que muestra ese QR.`, [
      { text: 'Cancelar', style: 'cancel', onPress: seguir },
      {
        text: 'Abrir',
        onPress: async () => {
          setEstado('vinculando');
          try {
            await asegurarSincronizado(id); // el servidor debe conocer el presupuesto antes de vincularlo
            await api('/access/pair/claim', { method: 'POST', body: { code: codigo, quote_id: id } });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEstado('listo');
            setTimeout(() => router.back(), 1600);
          } catch (err) {
            const vencido = err instanceof ApiError && err.status === 404;
            decidir(vencido ? 'Ese QR venció' : 'No se pudo abrir', vencido ? 'Actualiza la pantalla del computador y escanea el QR nuevo.' : mensajeDe(err), [{ text: 'Entendido', onPress: seguir }]);
          }
        },
      },
    ]);
  }

  if (!permiso) return <View style={[e.centro, { backgroundColor: t.fondo }]} />;
  if (!permiso.granted) {
    return (
      <View style={[e.centro, { backgroundColor: t.fondo }]}>
        <TextoM variante="subtitulo" style={e.texto}>Necesitamos la cámara</TextoM>
        <TextoM suave style={e.texto}>Solo para leer el QR de la pantalla del computador. No se guarda ninguna imagen.</TextoM>
        {permiso.canAskAgain ? <BotonM titulo="Permitir la cámara" onPress={() => void pedirPermiso()} /> : <BotonM titulo="Abrir ajustes" onPress={() => void Linking.openSettings()} />}
        <BotonM titulo="Mejor escribo el código" variante="texto" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={e.camara}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={estado === 'buscando' ? ({ data }) => void alLeer(data) : undefined} />
      <View style={e.guia} pointerEvents="none">
        <View style={[e.marco, estado === 'listo' && { borderColor: '#2DA44E' }]} />
      </View>
      <View style={[e.pie, { backgroundColor: t.fondo }]}>
        <TextoM variante="subtitulo" style={e.texto} accessibilityLiveRegion="polite">
          {estado === 'buscando' ? 'Apunta al QR de tu computador' : estado === 'vinculando' ? 'Abriendo…' : 'Listo. Revisa tu computador.'}
        </TextoM>
        <TextoM suave variante="chico" style={e.texto}>
          {estado === 'listo' ? 'El presupuesto ya se está abriendo en la web.' : 'Es el QR que aparece junto a la caja «Consultar presupuesto», en la portada de la web.'}
        </TextoM>
        {estado === 'listo' ? null : <BotonM titulo="Cancelar" variante="secundario" onPress={() => router.back()} />}
      </View>
      {dialogo}
    </View>
  );
}

const e = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, gap: espacio.l },
  texto: { textAlign: 'center' },
  camara: { flex: 1, backgroundColor: '#000' },
  guia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 140 },
  marco: { width: 240, height: 240, borderWidth: 4, borderColor: '#fff', borderRadius: 24, borderCurve: 'continuous' },
  pie: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: espacio.xl, paddingBottom: espacio.xxl, gap: espacio.s, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: 'continuous' },
});
