import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List } from 'react-native-paper';
import { api, mensajeDe } from '@/api/client';
import type { Usuario } from '@/api/types';
import { ElegirPais } from '@/components/elegir-pais';
import { SeccionM, TarjetaM } from '@/components/material';
import { Icono } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { bandera, tasaLegible } from '@/lib/paises';
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
      <SeccionM titulo="País" icono="globo" descripcion="Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian.">
        <TarjetaM sinRelleno>
          <List.Item
            title={`${bandera(pais.country)} ${pais.name}`}
            titleStyle={e.titulo}
            description={`${pais.currency} · ${pais.vat_label} ${tasaLegible(pais.vat_rate)} %`}
            onPress={() => setEligiendo(true)}
            accessibilityRole="button"
            accessibilityLabel={`País: ${pais.name}. Cambiar`}
            style={e.fila}
            right={() => (
              <View style={e.derecha}>
                <Icono nombre="despliegue" tamano={12} color={t.suave} />
              </View>
            )}
          />
        </TarjetaM>
      </SeccionM>
      {eligiendo ? <ElegirPais titulo="País" nota="Define la moneda y el impuesto de los presupuestos nuevos. Los que ya hiciste no cambian." detalle={(p) => `${p.currency} · ${p.vat_label} ${tasaLegible(p.vat_rate)} %`} actual={pais.country} alElegir={(c) => void cambiar(c)} alCerrar={() => setEligiendo(false)} /> : null}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  fila: { minHeight: 64, justifyContent: 'center', paddingHorizontal: espacio.l },
  titulo: { fontWeight: '600' },
  derecha: { justifyContent: 'center' },
});
