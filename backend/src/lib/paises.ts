// Países disponibles (Internacionalización.md §2). Única fuente de verdad de moneda e impuesto: el presupuesto copia estos datos al
// crearse (Contrato BD §21) y las tasas se corrigen aquí cuando cambia la ley. Se puede agregar un país sin migrar la base.
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
export const ZONA_POR_DEFECTO = 'America/Santiago';

export const paisDe = (codigo: string) => PAISES.find((p) => p.country === codigo);

// El país de un teléfono E.164 por su prefijo (el más largo que coincida). Sin coincidencia, undefined.
export const paisDelTelefono = (telefono: string) => [...PAISES].sort((a, b) => b.calling_code.length - a.calling_code.length).find((p) => telefono.startsWith(p.calling_code));

// Nombre IANA válido (America/Lima): lo que entiende Intl.
export const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat('es', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

// Formato del monto por moneda: símbolo y separador de miles, sin depender del ICU (que no agrupa igual en todos lados).
// Montos enteros en la unidad principal (Internacionalización.md §3.3).
export function formatoMonto(n: number, moneda: string): string {
  const p = PAISES.find((x) => x.currency === moneda) ?? PAIS_POR_DEFECTO;
  const sep = moneda === 'USD' ? ',' : p.thousands; // USD: estilo de dólar en Ecuador y Panamá
  const digitos = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${n < 0 ? '-' : ''}${p.symbol}${p.symbol.length > 1 ? ' ' : ''}${digitos}`;
}
