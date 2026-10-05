import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { Boton, Campo, Icono, Texto } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Nombre, teléfono y correo del cliente, corregibles con el lápiz (Contrato API §6): el cliente suele equivocarse al dárselos y los
// confirma después. Teléfono y correo, siempre (incluso con el presupuesto terminado); el nombre solo mientras se edita, porque sale en el PDF. Funciona sin conexión: se guarda en el teléfono y viaja por la cola.
export function ContactoCliente({ q, cambiar, nombreEditable }: { q: Presupuesto; cambiar: (f: (p: Presupuesto) => Presupuesto) => void; nombreEditable: boolean }) {
  const pais = usePais();
  const t = useTema();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(q.customer.name);
  const [telefono, setTelefono] = useState(q.customer.phone);
  const [correo, setCorreo] = useState(q.customer.email ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);

  function empezar() {
    setNombre(q.customer.name);
    setTelefono(q.customer.phone);
    setCorreo(q.customer.email ?? '');
    setErrores({});
    setAviso(null);
    setEditando(true);
  }

  async function guardar() {
    const tel = normalizarTelefono(telefono, pais.calling_code);
    const nom = nombre.trim();
    const e = {
      nombre: !nombreEditable || nom ? undefined : 'Escribe el nombre del cliente',
      telefono: tel ? undefined : 'Escribe un teléfono válido, con su código de país si es de otro (+51…)',
      correo: !correo.trim() || esCorreo(correo) ? undefined : 'Revisa el correo',
    };
    setErrores(e);
    if (e.nombre || e.telefono || e.correo || !tel) return;
    const mail = correo.trim().toLowerCase() || null;
    try {
      cambiar((p) => ({ ...p, customer: { ...p.customer, ...(nombreEditable && { name: nom }), phone: tel, email: mail } }));
      await encolar({ quote_id: q.id, method: 'PATCH', path: `/quotes/${q.id}/customer`, body: { phone: tel, email: mail, ...(nombreEditable && { name: nom }) } });
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
          <Texto variante="titulo">{q.customer.name}</Texto>
          <Texto suave>{q.customer.phone}</Texto>
          <Texto variante="chico" suave>{q.customer.email ?? 'Sin correo'}</Texto>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Corregir los datos del cliente" onPress={empezar} hitSlop={8} style={e.lapiz}>
          <View style={[e.circulo, { backgroundColor: `${t.acento}1A` }]}>
            <Icono nombre="lapiz" tamano={18} color={t.acento} />
          </View>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={e.form}>
      {nombreEditable ? <Campo etiqueta="Nombre del cliente" value={nombre} onChangeText={setNombre} error={errores.nombre} autoCapitalize="words" autoFocus /> : null}
      <Campo etiqueta="Teléfono del cliente" value={telefono} onChangeText={setTelefono} error={errores.telefono} keyboardType="phone-pad" autoFocus={!nombreEditable} />
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
  lapiz: { minWidth: MIN_TOQUE, minHeight: MIN_TOQUE, alignItems: 'center', justifyContent: 'center' },
  circulo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
