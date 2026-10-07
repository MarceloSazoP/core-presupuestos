import * as Haptics from 'expo-haptics';
import { avisar } from '@/lib/toast';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { BotonM, CampoM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { Icono } from '@/components/ui';
import { usePais } from '@/lib/pais-actual';
import { separarTelefono } from '@/lib/paises';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar } from '@/sync/cola';
import { espacio, useTema } from '@/theme';

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
          <TextoM fuerte numberOfLines={1} style={e.flexTexto}>{q.customer.name}</TextoM>
          <Icono nombre="lapiz" tamano={14} color={t.acento} />
        </View>
        <View style={e.contacto}>
          <View style={e.dato}>
            <Icono nombre="llamar" tamano={13} color={t.acento} />
            <TextoM variante="chico" suave numberOfLines={1}>{q.customer.phone}</TextoM>
          </View>
          <View style={[e.dato, e.correo]}>
            <Icono nombre="correo" tamano={13} color={t.acento} />
            <TextoM variante="chico" suave numberOfLines={1} style={e.flexTexto}>{q.customer.email ?? 'Sin correo'}</TextoM>
          </View>
        </View>
      </View>
    </Pressable>
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
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, maxWidth: 270 },
  sello: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  datos: { flexShrink: 1, gap: 1 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  correo: { flexShrink: 1 },
  flexTexto: { flexShrink: 1 },
});
