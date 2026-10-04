// Puntos de miles sin depender del ICU del teléfono (es-CL no agrupa los miles de 4 cifras): 1234567 → "1.234.567".
export const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const clp = (n: number) => `$${miles(n)}`;

// Monto en una caja de texto: se guardan solo los dígitos y se muestran con «$» y puntos de miles ("12500" → "$12.500"). Vacío sigue vacío.
export const montoEscrito = (digitos: string) => (digitos ? clp(Number(digitos)) : '');
export const soloDigitos = (texto: string) => texto.replace(/\D/g, '').slice(0, 12);
