// Puntos de miles sin depender del ICU del teléfono (es-CL no agrupa los miles de 4 cifras): 1234567 → "1.234.567".
export const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const clp = (n: number) => `$${miles(n)}`;
