const dinero = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const cantidad = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 });

export const clp = (n: number) => dinero.format(n);
export const cant = (n: number) => cantidad.format(n);

export const enmascararTelefono = (telefono: string) =>
  telefono.length < 4 ? "" : `${telefono.slice(0, 3)} ••• ${telefono.slice(-2)}`;

export function enmascararCorreo(correo: string): string {
  const [local = '', dominio = ''] = correo.split('@');
  return local.length <= 2 ? `${local[0] ?? ''}***@${dominio}` : `${local[0]}***${local.slice(-1)}@${dominio}`;
}
