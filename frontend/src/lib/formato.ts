import { dinero, separadorDe } from './paises';

const cantidad = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3, useGrouping: 'always' });

// El monto con el símbolo y los separadores de su moneda (lib/paises.ts); `clp` es el de Chile, solo para el ejemplo de la portada.
export { dinero };
export const clp = (n: number) => dinero(n, 'CLP');
export const cant = (n: number) => cantidad.format(n);

// Para campos que se formatean mientras se escribe: "1234567" -> "1.234.567" y "1234,5" -> "1.234,5" (coma decimal).
export const miles = (digitos: string, moneda = 'CLP') => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, separadorDe(moneda));
export const milesConDecimal = (crudo: string) => {
  const [entera = '', decimal] = crudo.split(',');
  return miles(entera) + (decimal === undefined ? '' : `,${decimal}`);
};

export const enmascararTelefono = (telefono: string) =>
  telefono.length < 4 ? "" : `${telefono.slice(0, 3)} ••• ${telefono.slice(-2)}`;
