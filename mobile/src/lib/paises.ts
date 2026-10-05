// Países disponibles (Internacionalización.md §2). Copia de la tabla del servidor (`backend/src/lib/paises.ts`), que es la fuente de
// verdad: una prueba del backend verifica que ambas coincidan. La app la necesita sin conexión, para escribir montos y teléfonos y
// para la vista previa del impuesto de un presupuesto creado en terreno. Sin importar nada de React Native: la usan las pruebas.
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
  { country: 'ES', name: 'España', currency: 'EUR', symbol: '€', thousands: '.', vat_label: 'IVA', vat_rate: 21, calling_code: '+34' },
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
export const paisDelTelefono = (telefono: string) => [...PAISES].sort((a, b) => b.calling_code.length - a.calling_code.length).find((p) => telefono.startsWith(p.calling_code));
export function separarTelefono(telefono: string, prefijoPorDefecto: string): { codigo: string; nacional: string } {
  const p = telefono.startsWith('+') ? paisDelTelefono(telefono) : undefined;
  if (p) return { codigo: p.calling_code, nacional: telefono.slice(p.calling_code.length) };
  return { codigo: prefijoPorDefecto, nacional: telefono };
}

// Monto entero con el símbolo y el separador de su moneda; sin depender del ICU del teléfono (no agrupa igual en todos lados).
// El dólar (Ecuador y Panamá) va siempre al estilo de dólar. Una moneda desconocida cae en la de Chile.
export function dinero(n: number, moneda = 'CLP'): string {
  const p = PAISES.find((x) => x.currency === moneda) ?? PAIS_POR_DEFECTO;
  const sep = moneda === 'USD' ? ',' : p.thousands;
  const digitos = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (moneda === 'EUR') return `${n < 0 ? '-' : ''}${digitos} ${p.symbol}`; // en España el símbolo va después
  return `${n < 0 ? '-' : ''}${p.symbol}${p.symbol.length > 1 ? ' ' : ''}${digitos}`;
}

// Monto en una caja de texto: se guardan solo los dígitos y se muestran con su símbolo y separadores. Vacío sigue vacío.
export const montoEscrito = (digitos: string, moneda = 'CLP') => (digitos ? dinero(Number(digitos), moneda) : '');
