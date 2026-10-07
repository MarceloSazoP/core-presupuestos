import { randomUUID } from 'expo-crypto';
import { avisar } from '@/lib/toast';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError, mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { useDialogo } from '@/components/dialogo';
import { BotonM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { guardarCodigo } from '@/lib/codigos';
import { guardarBorrador } from '@/sync/cola';
import { espacio, radio, useTema } from '@/theme';

// Un presupuesto rechazado se puede rehacer como 2.ª, 3.ª… versión (Contrato API §6). Lo que se envió no cambia: la versión
// nueva es otro presupuesto, con sus ítems y condiciones copiados, su propio código y su propio número. Requiere conexión.
export function NuevaVersion({ q }: { q: Presupuesto }) {
  const t = useTema();
  const { dialogo, decidir } = useDialogo();
  const [trabajando, setTrabajando] = useState(false);
  const siguiente = (q.version ?? 1) + 1;
  const abrir = (id: string) => router.push({ pathname: '/presupuesto/[id]', params: { id } });

  async function rehacer() {
    setTrabajando(true);
    try {
      // El id lo genera el teléfono: si la respuesta se pierde, repetir no crea dos versiones.
      const v = await api<Presupuesto & { access_code?: string }>(`/quotes/${q.id}/revise`, { method: 'POST', body: { id: randomUUID() }, reintentar: true });
      if (v.access_code) await guardarCodigo(v.id, v.access_code);
      await guardarBorrador(v);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      abrir(v.id);
    } catch (err) {
      // Otra sesión ya la había rehecho: se va a esa versión.
      if (err instanceof ApiError && err.code === 'ALREADY_REVISED' && err.details[0]) return abrir(err.details[0].message);
      avisar.error('No se pudo crear la nueva versión', mensajeDe(err));
    } finally {
      setTrabajando(false);
    }
  }

  const confirmar = () =>
    decidir(`¿Crear la versión ${siguiente}?`, 'Se copia este presupuesto con sus ítems, tareas y condiciones para que lo corrijas. Tendrá su propio código y su propio número, y dirá que es la versión ' + siguiente + '. El rechazado queda como está.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: `Crear versión ${siguiente}`, onPress: () => void rehacer() },
    ]);

  return (
    <View style={[e.tarjeta, { backgroundColor: `${t.error}14`, borderColor: `${t.error}66` }]}>
      <View style={e.rotulo}>
        <Icono nombre="alerta" tamano={18} color={t.error} />
        <TextoM fuerte color="error">Presupuesto rechazado</TextoM>
      </View>
      {q.next_version_id ? (
        <>
          <TextoM variante="chico" suave>Ya lo rehiciste como una versión nueva.</TextoM>
          <BotonM titulo="Ver la versión nueva" variante="secundario" onPress={() => abrir(q.next_version_id!)} />
        </>
      ) : (
        <>
          <TextoM variante="chico" suave>Puedes corregirlo y volver a enviarlo como la versión {siguiente}. Es un presupuesto nuevo: el rechazado no cambia.</TextoM>
          <BotonM titulo={`Crear versión ${siguiente}`} onPress={confirmar} cargando={trabajando} />
        </>
      )}
      {dialogo}
    </View>
  );
}

const e = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: radio.l, borderCurve: 'continuous', padding: espacio.l, gap: espacio.m },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
});
