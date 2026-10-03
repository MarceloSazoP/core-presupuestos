import 'server-only';
import { api, ApiError } from './api';
import { aPresupuesto, type Presupuesto, type QuoteApi } from './mapeo';
import { sesionActual, type Sesion } from './sesion';

export const esFinalizado = (p: Presupuesto): p is Presupuesto & { numero: string } => p.estado === 'FINALIZED' && p.numero !== null;

// Carga el presupuesto de la sesión desde la API. Sin sesión o con la sesión vencida (30 min) devuelve null.
export async function cargarPresupuesto(): Promise<{ sesion: Sesion; presupuesto: Presupuesto } | null> {
  const sesion = await sesionActual();
  if (!sesion) return null;
  try {
    return { sesion, presupuesto: aPresupuesto(await api<QuoteApi>(`/quotes/${sesion.quoteId}`, { token: sesion.token })) };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null; // vencida, revocada o rotada
    throw e;
  }
}
