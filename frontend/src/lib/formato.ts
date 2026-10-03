const dinero = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', useGrouping: 'always' });
const cantidad = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3, useGrouping: 'always' });

export const clp = (n: number) => dinero.format(n);
export const cant = (n: number) => cantidad.format(n);

// Para campos que se formatean mientras se escribe: "1234567" -> "1.234.567" y "1234,5" -> "1.234,5" (coma decimal).
export const miles = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const milesConDecimal = (crudo: string) => {
  const [entera = '', decimal] = crudo.split(',');
  return miles(entera) + (decimal === undefined ? '' : `,${decimal}`);
};

export const enmascararTelefono = (telefono: string) =>
  telefono.length < 4 ? "" : `${telefono.slice(0, 3)} ••• ${telefono.slice(-2)}`;

export function enmascararCorreo(correo: string): string {
  const [local = '', dominio = ''] = correo.split('@');
  return local.length <= 2 ? `${local[0] ?? ''}***@${dominio}` : `${local[0]}***${local.slice(-1)}@${dominio}`;
}
