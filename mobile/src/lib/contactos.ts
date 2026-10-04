import { Contact, requestPermissionsAsync } from 'expo-contacts';
import { Platform } from 'react-native';

// Trae UN contacto con el selector del sistema (Arquitectura §5, "Clientes recurrentes y contactos"): la app nunca lee
// la agenda completa; solo recibe lo que la persona elige. Se devuelve texto sin normalizar: el formulario lo valida.
export type DatosContacto = { nombre: string; telefono: string; correo: string; direccion: string };

export const hayContactos = Platform.OS !== 'web';

async function abrirSelector(): Promise<Contact | null> {
  try {
    return await Contact.presentPicker();
  } catch {
    // Si el sistema exige permiso, se pide una vez; si lo niegan, la opción simplemente no hace nada.
    if (!(await requestPermissionsAsync()).granted) return null;
    return Contact.presentPicker();
  }
}

export async function elegirContacto(): Promise<DatosContacto | null> {
  const c = await abrirSelector();
  if (!c) return null;
  const [nombre, telefonos, correos, direcciones] = await Promise.all([c.getFullName(), c.getPhones(), c.getEmails(), c.getAddresses()]);
  const celular = telefonos.find((t) => /mobile|cel|iphone/i.test(t.label ?? '')) ?? telefonos[0]; // prefiere el celular
  const d = direcciones[0];
  return {
    nombre: nombre?.trim() ?? '',
    telefono: celular?.number ?? '',
    correo: correos[0]?.address ?? '',
    direccion: d ? [d.street, d.city, d.region].filter(Boolean).join(', ') : '',
  };
}
