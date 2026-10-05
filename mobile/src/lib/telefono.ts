// Lleva lo que escribe la persona a E.164 (+56912345678), que es lo que exige la API. Sin prefijo se le antepone el del país del
// usuario (`prefijo`, por defecto Chile: lo que había antes de los varios países). Un número con «+» se respeta tal cual.
// Devuelve null si no se puede interpretar como teléfono (la API vuelve a validar).
export function normalizarTelefono(texto: string, prefijo = '+56'): string | null {
  const t = texto.trim();
  const digitos = t.replace(/\D/g, '');
  if (t.startsWith('+')) return /^[1-9]\d{7,14}$/.test(digitos) ? `+${digitos}` : null;
  if (prefijo === '+56') {
    if (digitos.length === 9 && digitos.startsWith('9')) return `+56${digitos}`; // móvil chileno sin prefijo
    if (digitos.length === 11 && digitos.startsWith('56')) return `+${digitos}`;
    return null;
  }
  const codigo = prefijo.slice(1);
  if (digitos.startsWith(codigo) && digitos.length >= codigo.length + 7 && digitos.length <= 15) return `+${digitos}`; // el prefijo escrito sin «+»
  if (digitos.length >= 7 && digitos.length <= 11) return `${prefijo}${digitos}`; // número nacional
  return null;
}

export const esCorreo = (texto: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto.trim());
