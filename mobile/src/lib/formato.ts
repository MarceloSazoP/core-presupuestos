// Montos: con el símbolo y los separadores de su moneda (lib/paises.ts). Aquí quedan los de la caja de texto.
export { dinero, montoEscrito } from './paises.ts';
export const soloDigitos = (texto: string) => texto.replace(/\D/g, '').slice(0, 12);
