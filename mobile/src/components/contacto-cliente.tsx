import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Texto } from '@/components/ui';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar } from '@/sync/cola';
import { espacio } from '@/theme';

// Teléfono y correo del cliente, siempre corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después, incluso con el presupuesto ya terminado. Funciona sin conexión: se guarda en el teléfono y viaja por la cola.
export function ContactoCliente({ q, cambiar }: { q: Presupuesto; cambiar: (f: (p: Presupuesto) => Presupuesto) => void }) {
  const [editando, setEditando] = useState(false);
  const [telefono, setTelefono] = useState(q.customer.phone);
  const [correo, setCorreo] = useState(q.customer.email ?? '');
  const [errores, setErrores] = useState<{ telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);

  function empezar() {
    setTelefono(q.customer.phone);
    setCorreo(q.customer.email ?? '');
    setErrores({});
    setAviso(null);
    setEditando(true);
  }

  async function guardar() {
    const tel = normalizarTelefono(telefono);
    const e = {
      telefono: tel ? undefined : 'Escribe un teléfono válido, por ejemplo 9 1234 5678',
      correo: !correo.trim() || esCorreo(correo) ? undefined : 'Revisa el correo',
    };
    setErrores(e);
    if (e.telefono || e.correo || !tel) return;
    const mail = correo.trim().toLowerCase() || null;
    try {
      cambiar((p) => ({ ...p, customer: { ...p.customer, phone: tel, email: mail } }));
      await encolar({ quote_id: q.id, method: 'PATCH', path: `/quotes/${q.id}/customer`, body: { phone: tel, email: mail } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditando(false);
    } catch (err) {
      setAviso(mensajeDe(err));
    }
  }

  if (!editando) {
    return (
      <View style={e.fila}>
        <View style={e.datos}>
          <Texto suave>{q.customer.phone}</Texto>
          <Texto variante="chico" suave>{q.customer.email ?? 'Sin correo'}</Texto>
        </View>
        <Boton titulo="Corregir" variante="texto" onPress={empezar} />
      </View>
    );
  }
  return (
    <View style={e.form}>
      <Campo etiqueta="Teléfono del cliente" value={telefono} onChangeText={setTelefono} error={errores.telefono} keyboardType="phone-pad" autoFocus />
      <Campo etiqueta="Correo del cliente" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} ayuda="Déjalo vacío si no tiene." />
      {aviso ? <Texto variante="chico" color="error" accessibilityRole="alert">{aviso}</Texto> : null}
      <View style={e.fila}>
        <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditando(false)} style={e.mitad} />
        <Boton titulo="Guardar" onPress={() => void guardar()} style={e.mitad} />
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  datos: { flex: 1, gap: espacio.xs },
  form: { gap: espacio.m },
  mitad: { flex: 1 },
});
