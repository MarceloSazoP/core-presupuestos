import * as Haptics from 'expo-haptics';
import { avisar } from '@/lib/toast';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Avatar, Card, Text, TouchableRipple } from 'react-native-paper';
import { mensajeDe } from '@/api/client';
import type { Presupuesto } from '@/api/types';
import { CampoTelefono } from '@/components/campo-telefono';
import { CampoM, HojaM, TarjetaM, TextoM } from '@/components/material';
import { Icono, type NombreIcono } from '@/components/ui';
import { ESTADOS } from '@/lib/estados';
import { usePais } from '@/lib/pais-actual';
import { separarTelefono } from '@/lib/paises';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
import { encolar } from '@/sync/cola';
import { espacio, useTema } from '@/theme';
import { bordeElevado } from '@/theme-paper';

// Nombre, teléfono y correo del cliente, corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después. Se ven en la tarjeta del cliente arriba del presupuesto (TarjetaCliente) y se corrigen en una hoja (EditarCliente). Funciona
// sin conexión: se guarda en el teléfono y viaja por la cola.

// Título de la barra: «Presupuesto» y, debajo, en qué va, en su color: «Pendiente», o su número y su estado comercial si ya se terminó,
// y la versión. El cliente no va aquí: tiene su tarjeta arriba del contenido. En iPhone el título va centrado; en Android, a la izquierda.
export function TituloPresupuesto({ q }: { q: Presupuesto }) {
  const t = useTema();
  const cerrado = q.doc_status === 'FINALIZED';
  const comercial = ESTADOS.find((s) => s.id === q.commercial_status);
  const colorEstado = !cerrado ? t.aviso : comercial ? t[comercial.tono] : t.ok;
  const version = (q.version ?? 1) > 1 ? q.version : null;
  const estado = [cerrado ? (q.number ?? 'Cerrado') : 'Pendiente', cerrado ? (comercial?.texto ?? 'Cerrado') : null, version ? `v${version}` : null].filter(Boolean).join(' · ');
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`Presupuesto. ${estado}`} style={[e.titulo, Platform.OS === 'ios' ? e.centro : null]}>
      <Text variant="titleMedium" numberOfLines={1} style={[e.nombre, { color: t.texto }]}>Presupuesto</Text>
      <View style={e.dato}>
        <View style={[e.punto, { backgroundColor: colorEstado }]} />
        <Text variant="labelMedium" numberOfLines={1} style={[e.flexTexto, { color: colorEstado }]}>{estado}</Text>
      </View>
    </View>
  );
}

// La tarjeta del cliente arriba del presupuesto (tarjeta elevada de Material): sus iniciales, el nombre y la dirección. Tocarla abre sus
// datos («Datos del cliente»: llamar, WhatsApp, correo y corregir nombre, teléfono y correo).
export function TarjetaCliente({ q, alTocar }: { q: Presupuesto; alTocar: () => void }) {
  const t = useTema();
  const direccion = q.customer.address || q.address;
  return (
    <Card
      mode="elevated"
      elevation={1}
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`Cliente: ${q.customer.name}. ${direccion ?? 'Sin dirección'}. Ver y editar sus datos`}
      style={[e.tarjetaCliente, bordeElevado(t)]}
    >
      <Card.Title
        title={q.customer.name}
        subtitle={direccion || 'Sin dirección'}
        titleVariant="titleMedium"
        subtitleVariant="bodyMedium"
        titleStyle={e.nombre}
        subtitleStyle={{ color: t.suave }}
        subtitleNumberOfLines={2}
        left={(props) => <Avatar.Text {...props} label={iniciales(q.customer.name)} color={t.acento} style={{ backgroundColor: `${t.acento}1F` }} />}
        right={() => (
          <View style={e.flechaCliente}>
            <Icono nombre="siguiente" tamano={18} color={t.suave} />
          </View>
        )}
        style={e.filaCliente}
      />
    </Card>
  );
}

export function EditarCliente({ q, cambiar, alCerrar }: { q: Presupuesto; cambiar: (f: (p: Presupuesto) => Presupuesto) => void; alCerrar: () => void }) {
  const t = useTema();
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

  // Llamar, WhatsApp y correo usan los datos guardados (los que ya conoce la app), no lo que se está escribiendo.
  const abrir = (url: string, que: string) => void Linking.openURL(url).catch(() => avisar.error(`No se pudo abrir ${que}`, 'Revisa que el teléfono tenga una app para eso.'));
  const telGuardado = q.customer.phone;
  const correoGuardado = q.customer.email;

  // Diseño aprobado (lienzo «Rediseño encabezado del presupuesto», Datos del cliente): arriba las iniciales y el nombre; tres accesos
  // rápidos (el teléfono y el correo ya no están en el título de la barra); y los campos para corregir nombre, teléfono y correo.
  return (
    <HojaM titulo="Datos del cliente" cancelar={{ titulo: 'Cancelar', onPress: alCerrar }} listo={{ titulo: 'Guardar', fuerte: true, onPress: () => void guardar() }} alCerrar={alCerrar}>
      <View style={e.cabeceraCliente}>
        <Avatar.Text size={64} label={iniciales(nombre || q.customer.name)} color={t.acento} style={{ backgroundColor: `${t.acento}1F` }} />
        <Text variant="headlineSmall" numberOfLines={2} style={[e.nombreGrande, { color: t.texto }]}>{nombre.trim() || q.customer.name}</Text>
      </View>
      <View style={e.accesos}>
        <Acceso icono="llamar" texto="Llamar" etiqueta={`Llamar a ${q.customer.name}`} alTocar={() => abrir(`tel:${telGuardado}`, 'el teléfono')} />
        <Acceso icono="mensaje" texto="WhatsApp" etiqueta={`Escribir a ${q.customer.name} por WhatsApp`} alTocar={() => abrir(`https://wa.me/${telGuardado.replace(/\D/g, '')}`, 'WhatsApp')} />
        <Acceso icono="correo" texto="Correo" etiqueta={correoGuardado ? `Escribir a ${correoGuardado}` : 'Sin correo guardado'} deshabilitado={!correoGuardado} alTocar={() => abrir(`mailto:${correoGuardado}`, 'el correo')} />
      </View>
      <TarjetaM>
        <CampoM etiqueta="Nombre del cliente" value={nombre} onChangeText={setNombre} error={errores.nombre} autoCapitalize="words" />
        <CampoTelefono material codigo={codigo} alCodigo={setCodigo} etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} error={errores.telefono} />
        <CampoM etiqueta="Correo" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} ayuda="Déjalo vacío si no tiene." />
        {aviso ? <TextoM variante="chico" color="error" accessibilityRole="alert">{aviso}</TextoM> : null}
      </TarjetaM>
      <TextoM variante="chico" suave>Si corriges el teléfono o el correo, los envíos y el seguimiento usan los nuevos.</TextoM>
    </HojaM>
  );
}

// Las iniciales del nombre (las dos primeras palabras), para el círculo de arriba.
const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';

// Un acceso rápido: el ícono en el acento sobre su tono suave y el nombre debajo (como la captura rápida de la visita).
function Acceso({ icono, texto, etiqueta, deshabilitado, alTocar }: { icono: NombreIcono; texto: string; etiqueta: string; deshabilitado?: boolean; alTocar: () => void }) {
  const t = useTema();
  return (
    <TouchableRipple
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={() => {
        void Haptics.selectionAsync();
        alTocar();
      }}
      borderless
      style={[e.acceso, { backgroundColor: `${t.acento}${t.oscuro ? '29' : '1A'}`, opacity: deshabilitado ? 0.45 : 1 }]}
    >
      <View style={e.contenidoAcceso}>
        <Icono nombre={icono} tamano={22} color={t.acento} />
        <Text variant="labelLarge" style={{ color: t.texto }}>{texto}</Text>
      </View>
    </TouchableRipple>
  );
}

const e = StyleSheet.create({
  titulo: { gap: 1, maxWidth: 230, paddingHorizontal: espacio.s, paddingVertical: 2 },
  tarjetaCliente: { borderRadius: 20 },
  filaCliente: { minHeight: 72, paddingVertical: espacio.s },
  flechaCliente: { paddingRight: espacio.l },
  centro: { alignItems: 'center' },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nombre: { fontWeight: '600' },
  punto: { width: 7, height: 7, borderRadius: 4 },
  flexTexto: { flexShrink: 1 },
  cabeceraCliente: { alignItems: 'center', gap: espacio.s, paddingTop: espacio.xs },
  nombreGrande: { fontWeight: '600', textAlign: 'center' },
  accesos: { flexDirection: 'row', gap: espacio.s },
  acceso: { flex: 1, height: 64, borderRadius: 16 },
  contenidoAcceso: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
