// Buscar un presupuesto por cliente, número, código o trabajo, sin importar tildes ni mayúsculas («jose» encuentra a «José»).
// Con varias palabras, cada una debe aparecer en alguna parte («juan enchufe»).
// La clase de abajo es el rango U+0300–U+036F (tildes, diéresis y demás marcas que NFD separa de la letra), escrito con los caracteres.
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function coincide(q: { customer: { name: string }; number: string | null; code_id?: string; service_description: string }, texto: string) {
  const palabras = plano(texto).split(/\s+/).filter(Boolean);
  const donde = plano(`${q.customer.name} ${q.number ?? ''} ${q.code_id ?? ''} ${q.service_description}`);
  return palabras.every((p) => donde.includes(p));
}

// Un cliente guardado por su nombre (sin tildes ni mayúsculas, cada palabra) o por parte de su teléfono (desde 3 dígitos).
export function coincideCliente(c: { name: string; phone: string }, texto: string) {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length >= 3 && c.phone.replace(/\D/g, '').includes(digitos)) return true;
  const palabras = plano(texto).split(/\s+/).filter(Boolean);
  return palabras.length > 0 && palabras.every((p) => plano(c.name).includes(p));
}

// ¿Ya hay un cliente guardado con este teléfono (en E.164)? El teléfono no es único (Contrato BD §3): la app solo lo sugiere.
export const clienteConTelefono = <C extends { phone: string }>(lista: readonly C[], telefono: string | null) => (telefono ? lista.find((c) => c.phone === telefono) : undefined);
