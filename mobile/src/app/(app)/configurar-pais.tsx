import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { ElegirPais } from '@/components/elegir-pais';
import { Icono, Presionable, Seccion, Tarjeta, Texto } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { bandera } from '@/lib/paises';
import { avisar } from '@/lib/toast';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// País: define la moneda y el impuesto de los presupuestos nuevos; los que ya hiciste no cambian.
export default function PaisDeLaCuenta() {
  const t = useTema();
  const pais = usePais();
  const { actualizar } = useSesion();
  const [eligiendo, setEligiendo] = useState(false);

  async function cambiar(country: string) {
    setEligiendo(false);
    if (country === pais.country) return;
    try {
      void actualizar(await api<Usuario>('/me', { method: 'PUT', body: { country } }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      avisar.exito('País cambiado', 'Los presupuestos nuevos usarán su moneda y su impuesto.');
    } catch (err) {
      avisar.error('No se pudo cambiar el país', mensajeDe(err));
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Seccion titulo="País" icono="globo" descripcion="Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian.">
        <Tarjeta style={e.tarjeta}>
          <Presionable accessibilityRole="button" accessibilityLabel={`País: ${pais.name}. Cambiar`} onPress={() => setEligiendo(true)} estilo={e.fila}>
            <View style={e.flex}>
              <Texto fuerte>{bandera(pais.country)} {pais.name}</Texto>
              <Texto variante="chico" suave>{pais.currency} · {pais.vat_label} {pais.vat_rate} %</Texto>
            </View>
            <Icono nombre="despliegue" tamano={12} color={t.suave} />
          </Presionable>
        </Tarjeta>
      </Seccion>
      {eligiendo ? <ElegirPais titulo="País" nota="Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian." detalle={(p) => `${p.currency} · ${p.vat_label} ${p.vat_rate} %`} actual={pais.country} alElegir={(c) => void cambiar(c)} alCerrar={() => setEligiendo(false)} /> : null}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  tarjeta: { padding: 0 },
  fila: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l },
  flex: { flex: 1 },
});
