import { borrar, guardar, leer } from '@/lib/almacen';
import { leerUltimoAcceso, type UltimoAcceso } from '@/lib/ultimo-acceso-datos';

// Guardado en el almacenamiento seguro del teléfono. Sobrevive a cerrar sesión: es justamente para volver a entrar sin escribir todo.
const CLAVE = 'ultimo-acceso';

export const cargarUltimoAcceso = async () => leerUltimoAcceso(await leer(CLAVE).catch(() => null));
export const recordarAcceso = (d: UltimoAcceso) => guardar(CLAVE, JSON.stringify(d)).catch(() => {});
export const olvidarAcceso = () => borrar(CLAVE).catch(() => {});
