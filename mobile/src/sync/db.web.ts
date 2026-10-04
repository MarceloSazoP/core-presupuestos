// Versión web (vista previa de desarrollo): la misma interfaz que db.ts sobre localStorage.
import type { NuevaOp, Op } from './db';
export type { NuevaOp, Op };

const leerOps = (): Op[] => JSON.parse(localStorage.getItem('balam:ops') ?? '[]');
const guardarOps = (o: Op[]) => localStorage.setItem('balam:ops', JSON.stringify(o));

export const ops = async () => leerOps();
export const agregarOp = async (o: NuevaOp) => {
  const todas = leerOps();
  guardarOps([...todas, { ...o, seq: (todas.at(-1)?.seq ?? 0) + 1, state: 'pending', attempts: 0, last_error: null }]);
};
export const cambiarOp = async (seq: number, c: Partial<Pick<Op, 'state' | 'attempts' | 'last_error'>>) => guardarOps(leerOps().map((o) => (o.seq === seq ? { ...o, ...c } : o)));
export const borrarOp = async (seq: number) => guardarOps(leerOps().filter((o) => o.seq !== seq));

export const leerKv = async (k: string) => localStorage.getItem(`balam:kv:${k}`);
export const guardarKv = async (k: string, v: string) => localStorage.setItem(`balam:kv:${k}`, v);
export const listarKv = async (prefijo: string) =>
  Object.keys(localStorage).filter((k) => k.startsWith(`balam:kv:${prefijo}`)).map((k) => localStorage.getItem(k)!);
export const limpiarTodo = async () => Object.keys(localStorage).filter((k) => k.startsWith('balam:')).forEach((k) => localStorage.removeItem(k));
