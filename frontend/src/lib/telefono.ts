// Lleva lo que escribe la persona a E.164 (+56912345678), que es lo que exige la API. Sin prefijo se asume Chile.
// Devuelve null si no se puede interpretar como teléfono (la API vuelve a validar). Misma regla que la app móvil.
export function normalizarTelefono(texto: string): string | null {
  const t = texto.trim();
  const digitos = t.replace(/\D/g, "");
  if (t.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digitos) ? `+${digitos}` : null;
  if (digitos.length === 9 && digitos.startsWith("9")) return `+56${digitos}`; // móvil chileno sin prefijo
  if (digitos.length === 11 && digitos.startsWith("56")) return `+${digitos}`;
  return null;
}

export const esCorreo = (texto: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto.trim());
