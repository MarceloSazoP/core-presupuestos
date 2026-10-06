import * as Haptics from 'expo-haptics';
import { avisar } from '@/lib/toast';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { Boton, Campo, Icono, Texto } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { separarTelefono } from '@/lib/paises';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar } from '@/sync/cola';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Nombre, teléfono y correo del cliente, corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después. Se ven en el título de la pantalla (TituloCliente) y se corrigen en una hoja (EditarCliente). Funciona sin conexión: se
// guarda en el teléfono y viaja por la cola.

// Título de la barra: el nombre y, debajo, teléfono y correo. Tocarlo abre la hoja para corregirlos.
export function TituloCliente({ q, alEditar }: { q: Presupuesto; alEditar: () => void }) {
  const t = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${q.customer.name}, ${q.customer.phone}, ${q.customer.email ?? 'sin correo'}. Corregir los datos del cliente`} onPress={alEditar} hitSlop={6} style={e.titulo}>
      {/* El presupuesto (documento) a la izquierda; a su lado, el cliente con su ícono, y debajo teléfono y correo. */}
      <View style={[e.sello, { backgroundColor: `${t.acento}1A` }]}>
        <Icono nombre="documento" tamano={18} color={t.acento} />
      </View>
      <View style={e.datos}>
        <View style={e.dato}>
          <Icono nombre="cliente" tamano={15} color={t.acento} />
          <Texto fuerte numberOfLines={1} style={e.flexTexto}>{q.customer.name}</Texto>
          <Icono nombre="lapiz" tamano={14} color={t.acento} />
        </View>
        <View style={e.contacto}>
          <View style={e.dato}>
            <Icono nombre="llamar" tamano={13} color={t.acento} />
            <Texto variante="chico" suave numberOfLines={1}>{q.customer.phone}</Texto>
          </View>
          <View style={[e.dato, e.correo]}>
            <Icono nombre="correo" tamano={13} color={t.acento} />
            <Texto variante="chico" suave numberOfLines={1} style={e.flexTexto}>{q.customer.email ?? 'Sin correo'}</Texto>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function EditarCliente({ q, cambiar, alCerrar }: { q: Presupuesto; cambiar: (f: (p: Presupuesto) => Presupuesto) => void; alCerrar: () => void }) {
  const pais = usePais();
  const t = useTema();
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
      await encolar({ quote_id: q.id, method: 'PATCH', path: `/quotes/${q.id}/customer`, body: { phone: tel, email: mail, name: nom } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alCerrar();
    } catch (err) {
      setAviso(mensajeDe(err));
      avisar.error('No se pudo guardar', mensajeDe(err));
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={[e.hoja, { backgroundColor: t.fondo }]}>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={alCerrar} hitSlop={8} style={e.lado}>
            <Texto color="acento">Cancelar</Texto>
          </Pressable>
          <Texto fuerte accessibilityRole="header">Datos del cliente</Texto>
          <View style={e.lado} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={e.form}>
          <Campo etiqueta="Nombre del cliente" value={nombre} onChangeText={setNombre} error={errores.nombre} autoCapitalize="words" />
          <CampoTelefono codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono del cliente" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
          <Campo etiqueta="Correo del cliente" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} ayuda="Déjalo vacío si no tiene." />
          {aviso ? <Texto variante="chico" color="error" accessibilityRole="alert">{aviso}</Texto> : null}
          <Boton titulo="Guardar" icono="listo" onPress={() => void guardar()} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, maxWidth: 270 },
  sello: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  datos: { flexShrink: 1, gap: 1 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  correo: { flexShrink: 1 },
  flexTexto: { flexShrink: 1 },
  hoja: { flex: 1 },
  barra: { minHeight: MIN_TOQUE + espacio.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  lado: { minWidth: 88, minHeight: MIN_TOQUE, justifyContent: 'center' },
  form: { padding: espacio.xl, gap: espacio.l },
});
