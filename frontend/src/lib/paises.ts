// Países disponibles (Internacionalización.md §2). Copia de la tabla del servidor (`backend/src/lib/paises.ts`), que es la fuente de
// verdad: una prueba del backend verifica que coincidan. La web la usa para mostrar los montos de cada presupuesto con su moneda y
// para completar teléfonos escritos sin prefijo.
export type Pais = { country: string; name: string; currency: string; symbol: string; thousands: '.' | ',' | ' '; vat_label: string; vat_rate: number; calling_code: string };

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
];

export const PAIS_POR_DEFECTO = PAISES[0]!; // Chile: lo que había antes de los varios países
export const paisDe = (codigo: string | null | undefined) => PAISES.find((p) => p.country === codigo) ?? PAIS_POR_DEFECTO;

// Monto entero con el símbolo y el separador de su moneda; sin depender del ICU del teléfono (no agrupa igual en todos lados).
// El dólar (Ecuador y Panamá) va siempre al estilo de dólar. Una moneda desconocida cae en la de Chile.
export function dinero(n: number, moneda = 'CLP'): string {
  const p = PAISES.find((x) => x.currency === moneda) ?? PAIS_POR_DEFECTO;
  const sep = moneda === 'USD' ? ',' : p.thousands;
  const digitos = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${n < 0 ? '-' : ''}${p.symbol}${p.symbol.length > 1 ? ' ' : ''}${digitos}`;
}

// Monto en una caja de texto: se guardan solo los dígitos y se muestran con su símbolo y separadores. Vacío sigue vacío.
export const montoEscrito = (digitos: string, moneda = 'CLP') => (digitos ? dinero(Number(digitos), moneda) : '');

// Separador de miles de una moneda, para los campos que se formatean mientras se escriben.
export const separadorDe = (moneda: string) => (moneda === 'USD' ? ',' : (PAISES.find((x) => x.currency === moneda) ?? PAIS_POR_DEFECTO).thousands);
