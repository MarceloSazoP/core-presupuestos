import { borrar, guardar, leer } from './almacen';

// El secreto del código de un presupuesto solo lo entrega el servidor al crearlo o al generar uno nuevo: no se puede
// volver a leer. Se guarda en el teléfono para mostrarlo después (Contrato API §9). Si se pierde, se genera otro.
const clave = (presupuestoId: string) => `codigo.${presupuestoId}`;

export const guardarCodigo = (presupuestoId: string, codigo: string) => guardar(clave(presupuestoId), codigo);
export const leerCodigo = (presupuestoId: string) => leer(clave(presupuestoId));
export const borrarCodigo = (presupuestoId: string) => borrar(clave(presupuestoId));
