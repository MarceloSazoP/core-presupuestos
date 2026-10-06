import { useSyncExternalStore } from 'react';
import { dinero } from '@/lib/formato';
import { guardarKv, leerKv } from '@/sync/db';

// «Ocultar montos» (el ojo, como en una contraseña): los montos se ven como puntos para que no se lean en el teléfono. Cada lugar tiene
// su propio ojo: el del inicio (`INICIO`), el de la pantalla de Presupuestos (`LISTA`, todas sus filas) y uno por presupuesto
// (`delPresupuesto(id)`, el de su total, dentro de su pantalla). La preferencia se guarda en el teléfono: no se pierde al cambiar de pantalla ni al cerrar la app. Solo oculta lo que se
// muestra: lo que se envía o se comparte lleva siempre los montos reales.
export const INICIO = 'inicio';
export const LISTA = 'lista'; // la pantalla de Presupuestos (Pendientes, Enviados…): un solo ojo para todas sus filas
export const delPresupuesto = (id: string) => `p:${id}`;

const KV = 'montos-ocultos';
const PUNTOS = '••••••';
let ocultos: Record<string, true> = {}; // solo se guardan los ocultos: lo que no está, se ve
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());

void leerKv(KV)
  .then((v) => {
    if (!v) return;
    ocultos = { ...(JSON.parse(v) as Record<string, true>), ...ocultos };
    emitir();
  })
  .catch(() => {});

export function alternarMontos(clave: string) {
  const resto = { ...ocultos };
  if (resto[clave]) delete resto[clave];
  else resto[clave] = true;
  ocultos = resto;
  emitir();
  void guardarKv(KV, JSON.stringify(ocultos)).catch(() => {});
}

const suscribir = (f: () => void) => (oyentes.add(f), () => void oyentes.delete(f));
export const useMontosOcultos = (clave: string) => useSyncExternalStore(suscribir, () => !!ocultos[clave], () => !!ocultos[clave]);

// Para mostrar un monto: con la moneda del presupuesto, o puntos si ese lugar los tiene ocultos.
export function useDinero(clave: string) {
  const o = useMontosOcultos(clave);
  return (n: number, moneda?: string) => (o ? PUNTOS : dinero(n, moneda ?? 'CLP'));
}
