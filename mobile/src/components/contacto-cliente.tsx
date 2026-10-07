import * as Haptics from 'expo-haptics';
import { avisar } from '@/lib/toast';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { BotonM, CampoM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { ESTADOS } from '@/lib/estados';
import { usePais } from '@/lib/pais-actual';
import { separarTelefono } from '@/lib/paises';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar } from '@/sync/cola';
import { espacio, useTema } from '@/theme';

// Nombre, teléfono y correo del cliente, corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después. Se ven en el título de la pantalla (TituloCliente) y se corrigen en una hoja (EditarCliente). Funciona sin conexión: se
// guarda en el teléfono y viaja por la cola.

// Título de la barra: el nombre del cliente con un lápiz (tocarlo abre la hoja para corregir nombre, teléfono y correo) y, debajo, en qué
// va el presupuesto, en su color: «Pendiente», o su número y su estado comercial si ya se terminó, y la versión. El teléfono y el correo
// no van aquí (no cabían): están en la hoja del cliente. En iPhone el título va centrado; en Android, a la izquierda.
export function TituloCliente({ q, alEditar }: { q: Presupuesto; alEditar: () => void }) {
  const t = useTema();
  const cerrado = q.doc_status === 'FINALIZED';
  const comercial = ESTADOS.find((s) => s.id === q.commercial_status);
  const colorEstado = !cerrado ? t.aviso : comercial ? t[comercial.tono] : t.ok;
  const version = (q.version ?? 1) > 1 ? q.version : null;
  const estado = [cerrado ? (q.number ?? 'Cerrado') : 'Pendiente', cerrado ? (comercial?.texto ?? 'Cerrado') : null, version ? `v${version}` : null].filter(Boolean).join(' · ');
  const centrado = Platform.OS === 'ios';
  return (
    <TouchableRipple
      accessibilityRole="button"
      accessibilityLabel={`${q.customer.name}. ${estado}. Datos del cliente: ${q.customer.phone}, ${q.customer.email ?? 'sin correo'}. Editar`}
      onPress={alEditar}
      hitSlop={6}
      borderless
      style={e.toque}
    >
      <View style={[e.titulo, centrado ? e.centro : null]}>
        <View style={e.dato}>
          <Text variant="titleMedium" numberOfLines={1} style={[e.flexTexto, e.nombre, { color: t.texto }]}>{q.customer.name}</Text>
          <Icono nombre="lapiz" tamano={14} color={t.acento} />
        </View>
        <View style={e.dato}>
          <View style={[e.punto, { backgroundColor: colorEstado }]} />
          <Text variant="labelMedium" numberOfLines={1} style={[e.flexTexto, { color: colorEstado }]}>{estado}</Text>
        </View>
      </View>
    </TouchableRipple>
  );
}

export function EditarCliente({ q, cambiar, alCerrar }: { q: Presupuesto; cambiar: (f: (p: Presupuesto) => Presupuesto) => void; alCerrar: () => void }) {
  const pais = usePais();
  const [nombre, setNombre] = useState(q.customer.name);
  const [telefono, setTelefono] = useState(separarTelefono(q.customer.phone, pais.calling_code).nacional);
  const [codigo, setCodigo] = useState(separarTelefono(q.customer.phone, pais.calling_code).codigo);
  const [correo, setCorreo] = useState(q.customer.email ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    const tel = normalizarTelefono(telefono, codigo);
    const nom = nombre.trim();
    const e = {
      nombre: nom ? undefined : 'Escribe el nombre del cliente',
      telefono: tel ? undefined : 'Escribe un teléfono válido, con su código de país',
      correo: !correo.trim() || esCorreo(correo) ? undefined : 'Revisa el correo',
    };
    setErrores(e);
    if (e.nombre || e.telefono || e.correo || !tel) return;
    const mail = correo.trim().toLowerCase() || null;
    try {
      cambiar((p) => ({ ...p, customer: { ...p.customer, name: nom, phone: tel, email: mail } }));
      // Se cierra la hoja antes de esperar la cola: con los datos ya cambiados, esperar con la hoja abierta la dejaba a medio cerrar
      // (una hoja blanca que bloqueaba toda la pantalla).
      alCerrar();
      await encolar({ quote_id: q.id, method: 'PATCH', path: `/quotes/${q.id}/customer`, body: { phone: tel, email: mail, name: nom } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setAviso(mensajeDe(err));
      avisar.error('No se pudo guardar', mensajeDe(err));
    }
  }

  return (
    <HojaM titulo="Datos del cliente" cancelar={{ titulo: 'Cancelar', onPress: alCerrar }} listo={{ titulo: 'Guardar', fuerte: true, onPress: () => void guardar() }} alCerrar={alCerrar}>
      <TarjetaM>
        <CampoM etiqueta="Nombre del cliente" value={nombre} onChangeText={setNombre} error={errores.nombre} autoCapitalize="words" />
        <CampoTelefono material codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono del cliente" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
        <CampoM etiqueta="Correo del cliente" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} ayuda="Déjalo vacío si no tiene." />
        {aviso ? <TextoM variante="chico" color="error" accessibilityRole="alert">{aviso}</TextoM> : null}
      </TarjetaM>
      <BotonM titulo="Guardar" icono="listo" onPress={() => void guardar()} />
    </HojaM>
  );
}

const e = StyleSheet.create({
  toque: { borderRadius: 12, maxWidth: 230 },
  titulo: { gap: 1, paddingHorizontal: espacio.s, paddingVertical: 2 },
  centro: { alignItems: 'center' },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nombre: { fontWeight: '600' },
  punto: { width: 7, height: 7, borderRadius: 4 },
  flexTexto: { flexShrink: 1 },
});
