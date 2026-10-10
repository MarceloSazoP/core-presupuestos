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

// Cómo se ve un teléfono mientras se escribe, por país (grupos de dígitos separados por espacio): Chile 9 5482 2089, Perú 987 654 321,
// México 55 1234 5678, España 612 345 678… Los móviles y los fijos tienen formas distintas: se elige por el primer dígito. Es solo
// visual: lo guardado es el número completo con su prefijo (+56954822089).
const FORMATOS: Record<string, (primero: string) => number[]> = {
  '+56': () => [1, 4, 4],
  '+51': (d) => (d === '9' ? [3, 3, 3] : [2, 3, 4]),
  '+57': () => [3, 3, 4],
  '+52': () => [2, 4, 4],
  '+54': (d) => (d === '9' ? [1, 2, 4, 4] : [2, 4, 4]),
  '+598': (d) => (d === '9' ? [2, 3, 3] : [1, 3, 4]),
  '+595': (d) => (d === '9' ? [3, 3, 3] : [2, 3, 4]),
  '+591': () => [8],
  '+593': (d) => (d === '9' ? [2, 3, 4] : [1, 3, 4]),
  '+506': () => [4, 4],
  '+507': () => [4, 4],
  '+502': () => [4, 4],
  '+34': (d) => (d === '6' || d === '7' ? [3, 3, 3] : [2, 3, 2, 2]),
  '+58': () => [3, 3, 4],
  '+504': () => [4, 4],
  '+503': () => [4, 4],
  '+505': () => [4, 4],
  '+53': () => [4, 4],
  '+1': () => [3, 3, 4],
  '+240': () => [3, 3, 3],
};

// Da forma visual al número que escribe la persona. Uno que empieza con «+» es de otro país y se deja como se escribió; sin formato
// conocido (prefijo desconocido) también.
export function formatearTelefono(texto: string, prefijo: string): string {
  if (texto.trim().startsWith('+')) return texto;
  const digitos = texto.replace(/\D/g, '').slice(0, 15);
  const grupos = FORMATOS[prefijo]?.(digitos[0] ?? '');
  if (!grupos) return digitos;
  const partes: string[] = [];
  let i = 0;
  for (const n of grupos) {
    if (i >= digitos.length) break;
    partes.push(digitos.slice(i, i + n));
    i += n;
  }
  if (i < digitos.length) partes.push(digitos.slice(i)); // dígitos de más (variantes de numeración): al final, sin grupo
  return partes.join(' ');
}

// Lo que se ve en la caja vacía: la forma del número de cada país con X (no un número de ejemplo).
const PLANTILLAS: Record<string, string> = {
  '+56': '9 XXXX XXXX', '+51': '9XX XXX XXX', '+57': '3XX XXX XXXX', '+52': 'XX XXXX XXXX', '+54': '9 XX XXXX XXXX', '+598': '9X XXX XXX', '+595': '9XX XXX XXX',
  '+591': 'XXXXXXXX', '+593': '9X XXX XXXX', '+506': 'XXXX XXXX', '+507': 'XXXX XXXX', '+502': 'XXXX XXXX', '+34': 'XXX XXX XXX',
  '+58': '4XX XXX XXXX', '+504': 'XXXX XXXX', '+503': 'XXXX XXXX', '+505': 'XXXX XXXX', '+53': '5XXX XXXX', '+1': 'XXX XXX XXXX', '+240': 'XXX XXX XXX',
};
export const plantillaTelefono = (prefijo: string) => PLANTILLAS[prefijo] ?? 'XXXXXXXX';
