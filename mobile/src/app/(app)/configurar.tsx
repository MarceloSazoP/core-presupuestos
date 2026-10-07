import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Text, TouchableRipple } from 'react-native-paper';
import { FilaAjuste, GrupoAjustes } from '@/components/fila-ajuste';
import { TarjetaM } from '@/components/material';
import { Icono } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { bandera } from '@/lib/paises';
import { leerPreferenciaTema, OPCIONES_TEMA, type PreferenciaTema } from '@/lib/preferencia-tema';
import { useSesion } from '@/session';
import { espacio, useTema } from '@/theme';

// «Configurar» con Material 3: arriba tu perfil, que abre «Mi cuenta», y debajo grupos de opciones en listas; cada una abre su propia
// ventana (configurar-*.tsx). Los datos con que ingresas (teléfono y correo) no se cambian aquí: son tu identidad (Contrato API §4).
export default function Configurar() {
  const t = useTema();
  const { usuario } = useSesion();
  const pais = usePais();
  const [tema, setTema] = useState<PreferenciaTema>('sistema');
  useEffect(() => void leerPreferenciaTema().then(setTema), []);
  const inicial = (usuario?.name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      {/* Tu perfil es la entrada a «Mi cuenta» (QR para entrar en otro teléfono, exportar, cerrar sesión, eliminar): toda la tarjeta se
          toca, con la onda de Material, y lo dicen la flecha a la derecha y la etiqueta «Mi cuenta» bajo el correo. */}
      <TarjetaM elevacion={2} sinRelleno>
        <TouchableRipple
          accessibilityRole="button"
          accessibilityLabel={`${usuario?.name ?? ''}, ${usuario?.phone ?? ''}, ${usuario?.email ?? ''}. Abrir Mi cuenta`}
          accessibilityHint="Entrar en otro teléfono, exportar tus datos, cerrar sesión o eliminar la cuenta"
          onPress={() => router.push('/configurar-cuenta')}
          style={e.toquePerfil}
        >
          <View style={e.perfil}>
            <Avatar.Text size={64} label={inicial} color={t.sobreAcento} style={{ backgroundColor: t.acento }} />
            <View style={e.perfilTextos}>
              <Text variant="titleLarge" numberOfLines={1}>{usuario?.name ?? ''}</Text>
              <Text variant="bodyMedium" numberOfLines={1} style={{ color: t.suave }}>{usuario?.phone ?? ''}</Text>
              <Text variant="bodyMedium" numberOfLines={1} style={{ color: t.suave }}>{usuario?.email ?? ''}</Text>
              <View style={[e.etiquetaCuenta, { backgroundColor: `${t.acento}1F` }]}>
                <Icono nombre="cuenta" tamano={14} color={t.acento} />
                <Text variant="labelLarge" style={{ color: t.acento }}>Mi cuenta</Text>
              </View>
            </View>
            <Icono nombre="siguiente" tamano={16} color={t.acento} />
          </View>
        </TouchableRipple>
      </TarjetaM>

      <GrupoAjustes>
        <FilaAjuste primera icono="cliente" color={t.acento} titulo="Mis datos" alTocar={() => router.push('/configurar-datos')} />
        <FilaAjuste icono="galeria" color={t.seguimiento} titulo="Logo y firma" alTocar={() => router.push('/configurar-imagenes')} />
        <FilaAjuste icono="globo" color={t.info} titulo="País" valor={`${bandera(pais.country)} ${pais.name}`} alTocar={() => router.push('/configurar-pais')} />
      </GrupoAjustes>

      <GrupoAjustes>
        <FilaAjuste primera icono="luna" color={t.suave} titulo="Apariencia" valor={OPCIONES_TEMA.find((o) => o.id === tema)?.texto} alTocar={() => router.push('/configurar-apariencia')} />
        <FilaAjuste icono="info" color={t.info} titulo="Información" alTocar={() => router.push('/configurar-informacion')} />
      </GrupoAjustes>

    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl },
  toquePerfil: { padding: espacio.l },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  perfilTextos: { flex: 1, gap: 2 },
  // Etiqueta tonal que dice a dónde lleva tocar la tarjeta.
  etiquetaCuenta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 28, borderRadius: 14, paddingHorizontal: 10, marginTop: espacio.s },
});
