// Países disponibles (Internacionalización.md §2). Copia de la tabla del servidor (`backend/src/lib/paises.ts`), que es la fuente de
// verdad: una prueba del backend verifica que ambas coincidan. La web la usa para mostrar los montos de cada presupuesto con su moneda y
// para completar teléfonos escritos sin prefijo.
export type Pais = { country: string; name: string; currency: string; symbol: string; thousands: '.' | ',' | ' '; vat_label: string; vat_rate: number; calling_code: string; area_codes?: readonly string[] };

export const PAISES: readonly Pais[] = [
  { country: 'CL', name: 'Chile', currency: 'CLP', symbol: '$', thousands: '.', vat_label: 'IVA', vat_rate: 19, calling_code: '+56' },
  { country: 'PE', name: 'Perú', currency: 'PEN', symbol: 'S/', thousands: ',', vat_label: 'IGV', vat_rate: 18, calling_code: '+51' },
  { country: 'CO', name: 'Colombia', currency: 'COP', symbol: '$', thousands: '.', vat_label: 'IVA', vat_rate: 19, calling_code: '+57' },
  { country: 'MX', name: 'México', currency: 'MXN', symbol: '$', thousands: ',', vat_label: 'IVA', vat_rate: 16, calling_code: '+52' },
  { country: 'AR', name: 'Argentina', currency: 'ARS', symbol: '$', thousands: '.', vat_label: 'IVA', vat_rate: 21, calling_code: '+54' },
  { country: 'UY', name: 'Uruguay', currency: 'UYU', symbol: '$U', thousands: '.', vat_label: 'IVA', vat_rate: 22, calling_code: '+598' },
  { country: 'PY', name: 'Paraguay', currency: 'PYG', symbol: '₲', thousands: '.', vat_label: 'IVA', vat_rate: 10, calling_code: '+595' },
  { country: 'BO', name: 'Bolivia', currency: 'BOB', symbol: 'Bs', thousands: '.', vat_label: 'IVA', vat_rate: 13, calling_code: '+591' },
  { country: 'EC', name: 'Ecuador', currency: 'USD', symbol: '$', thousands: ',', vat_label: 'IVA', vat_rate: 15, calling_code: '+593' },
  { country: 'CR', name: 'Costa Rica', currency: 'CRC', symbol: '₡', thousands: ' ', vat_label: 'IVA', vat_rate: 13, calling_code: '+506' },
  { country: 'PA', name: 'Panamá', currency: 'USD', symbol: '$', thousands: ',', vat_label: 'ITBMS', vat_rate: 7, calling_code: '+507' },
  { country: 'GT', name: 'Guatemala', currency: 'GTQ', symbol: 'Q', thousands: ',', vat_label: 'IVA', vat_rate: 12, calling_code: '+502' },
  { country: 'ES', name: 'España', currency: 'EUR', symbol: '€', thousands: '.', vat_label: 'IVA', vat_rate: 21, calling_code: '+34' },
  { country: 'VE', name: 'Venezuela', currency: 'VES', symbol: 'Bs.', thousands: '.', vat_label: 'IVA', vat_rate: 16, calling_code: '+58' },
  { country: 'HN', name: 'Honduras', currency: 'HNL', symbol: 'L', thousands: ',', vat_label: 'ISV', vat_rate: 15, calling_code: '+504' },
  { country: 'SV', name: 'El Salvador', currency: 'USD', symbol: '$', thousands: ',', vat_label: 'IVA', vat_rate: 13, calling_code: '+503' },
  { country: 'NI', name: 'Nicaragua', currency: 'NIO', symbol: 'C$', thousands: ',', vat_label: 'IVA', vat_rate: 15, calling_code: '+505' },
  { country: 'CU', name: 'Cuba', currency: 'CUP', symbol: '$', thousands: ',', vat_label: 'Impuesto sobre ventas', vat_rate: 10, calling_code: '+53' },
  // Comparten el +1 con Estados Unidos y Canadá: se reconocen por su código de área (Internacionalización.md §2).
  { country: 'DO', name: 'República Dominicana', currency: 'DOP', symbol: 'RD$', thousands: ',', vat_label: 'ITBIS', vat_rate: 18, calling_code: '+1', area_codes: ['809', '829', '849'] },
  { country: 'PR', name: 'Puerto Rico', currency: 'USD', symbol: '$', thousands: ',', vat_label: 'IVU', vat_rate: 11.5, calling_code: '+1', area_codes: ['787', '939'] },
  { country: 'GQ', name: 'Guinea Ecuatorial', currency: 'XAF', symbol: 'FCFA', thousands: '.', vat_label: 'IVA', vat_rate: 15, calling_code: '+240' },
];

// Para las listas que se muestran: Chile siempre primero y después todos los demás por orden alfabético.
const PRIMEROS = ['CL'];
export const PAISES_ORDENADOS: readonly Pais[] = [...PAISES].sort((a, b) => {
  const [i, j] = [PRIMEROS.indexOf(a.country), PRIMEROS.indexOf(b.country)];
  if (i >= 0 || j >= 0) return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
  return a.name.localeCompare(b.name, 'es');
});

// La bandera de un país a partir de su código de dos letras (CL → 🇨🇱): cada letra se vuelve su «indicador regional» Unicode.
export const bandera = (country: string) => String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export const PAIS_POR_DEFECTO = PAISES[0]!; // Chile: lo que había antes de los varios países
export const paisDe = (codigo: string | null | undefined) => PAISES.find((p) => p.country === codigo) ?? PAIS_POR_DEFECTO;

// El país de un teléfono E.164 por su prefijo (el más largo que coincida), y el teléfono partido en prefijo y número nacional: así un
// número guardado se muestra en el selector de país y su caja. Un teléfono de otro país no listado queda entero, con «+», en la caja.
// Un +1 solo es de República Dominicana o Puerto Rico si su código de área es de ellos; otro +1 (Estados Unidos…) no adivina.
export const paisDelTelefono = (telefono: string) =>
  [...PAISES].sort((a, b) => b.calling_code.length - a.calling_code.length).find((p) => (p.area_codes ?? ['']).some((area) => telefono.startsWith(p.calling_code + area)));
export function separarTelefono(telefono: string, prefijoPorDefecto: string): { codigo: string; nacional: string } {
  const p = telefono.startsWith('+') ? paisDelTelefono(telefono) : undefined;
  if (p) return { codigo: p.calling_code, nacional: telefono.slice(p.calling_code.length) };
  return { codigo: prefijoPorDefecto, nacional: telefono };
}

// Monto entero con el símbolo y el separador de su moneda; sin depender del ICU del teléfono (no agrupa igual en todos lados).
// El dólar (Ecuador, El Salvador, Panamá, Puerto Rico) va siempre al estilo de dólar. Una moneda desconocida cae en la de Chile.
export function dinero(n: number, moneda = 'CLP'): string {
  const p = PAISES.find((x) => x.currency === moneda) ?? PAIS_POR_DEFECTO;
  const sep = moneda === 'USD' ? ',' : p.thousands;
  const digitos = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (moneda === 'EUR' || moneda === 'XAF') return `${n < 0 ? '-' : ''}${digitos} ${p.symbol}`; // en España y Guinea Ecuatorial el símbolo va después
  return `${n < 0 ? '-' : ''}${p.symbol}${p.symbol.length > 1 ? ' ' : ''}${digitos}`;
}

// Monto en una caja de texto: se guardan solo los dígitos y se muestran con su símbolo y separadores. Vacío sigue vacío.
export const montoEscrito = (digitos: string, moneda = 'CLP') => (digitos ? dinero(Number(digitos), moneda) : '');

// Separador de miles de una moneda, para los campos que se formatean mientras se escriben.
export const separadorDe = (moneda: string) => (moneda === 'USD' ? ',' : (PAISES.find((x) => x.currency === moneda) ?? PAIS_POR_DEFECTO).thousands);

// La tasa del impuesto como se escribe en español, con coma decimal: 19, 11,5 (Puerto Rico).
export const tasaLegible = (tasa: number) => String(tasa).replace('.', ',');
