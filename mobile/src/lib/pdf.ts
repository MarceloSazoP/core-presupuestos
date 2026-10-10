import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { ApiError, descargar } from '@/api/client';

// Ver el PDF de un presupuesto terminado (Arquitectura §5, «Envío y seguimiento»). Se descarga con la sesión por la misma API que ya
// usa la app (no depende del enlace web) y se abre: en Android con el visor de PDF del teléfono; en iPhone, en la pantalla `pdf`
// de la app (el sistema lo dibuja con zoom y deja compartirlo).
const ACTION_VIEW = 'android.intent.action.VIEW';
const FLAG_GRANT_READ_URI_PERMISSION = 1; // el visor puede leer el archivo de la app

export async function abrirPdf(q: { id: string; number: string | null }) {
  const nombre = `${q.number ?? 'presupuesto'}.pdf`;
  const archivo = await descargar(`/quotes/${q.id}/pdf`, new File(Paths.cache, nombre));
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(ACTION_VIEW, { data: archivo.contentUri, flags: FLAG_GRANT_READ_URI_PERMISSION, type: 'application/pdf' });
    } catch {
      throw new ApiError(0, 'SIN_VISOR', 'Este teléfono no tiene una app para ver PDF. Instala Google Drive o un lector de PDF.');
    }
    return;
  }
  router.push({ pathname: '/pdf', params: { uri: archivo.uri, titulo: q.number ?? 'Presupuesto' } });
}
