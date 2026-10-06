import { useSyncExternalStore } from 'react';

// Avisos que bajan desde arriba para decir qué pasó (error, listo, ojo o dato). Se cuentan solos: no piden confirmar nada; lo que
// sí necesita una respuesta (¿Eliminar?, ¿Terminar?) sigue siendo una pregunta con botones.
export type TipoToast = 'error' | 'exito' | 'aviso' | 'info';
export type Toast = { id: number; tipo: TipoToast; titulo: string; texto?: string };

const MAX = 3; // más que eso tapa la pantalla: el más antiguo se va
let lista: Toast[] = [];
let siguiente = 1;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());

export const cerrarToast = (id: number) => {
  lista = lista.filter((x) => x.id !== id);
  emitir();
};

function mostrar(tipo: TipoToast, titulo: string, texto?: string) {
  const repetido = lista.find((x) => x.tipo === tipo && x.titulo === titulo && x.texto === texto);
  if (repetido) cerrarToast(repetido.id); // el mismo aviso dos veces seguidas se reemplaza, no se apila
  lista = [...lista, { id: siguiente++, tipo, titulo, texto }].slice(-MAX);
  emitir();
}

export const avisar = {
  error: (titulo: string, texto?: string) => mostrar('error', titulo, texto),
  exito: (titulo: string, texto?: string) => mostrar('exito', titulo, texto),
  aviso: (titulo: string, texto?: string) => mostrar('aviso', titulo, texto),
  info: (titulo: string, texto?: string) => mostrar('info', titulo, texto),
};

const suscribir = (f: () => void) => (oyentes.add(f), () => void oyentes.delete(f));
export const useToasts = () => useSyncExternalStore(suscribir, () => lista, () => lista);
