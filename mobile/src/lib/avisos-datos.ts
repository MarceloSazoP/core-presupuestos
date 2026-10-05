// Bandeja de avisos: los que le llegan al teléfono (recordatorios de contacto) quedan también dentro de la app. Lógica pura, sin
// React Native, para poder probarla.
export type Aviso = { id: string; titulo: string; cuerpo: string; quoteId: string | null; fecha: string; leido: boolean };
export const MAX_AVISOS = 50;

// Agrega un aviso arriba (más reciente primero). Si ya estaba (mismo id) se deja como está, para no volver a marcarlo como nuevo, y la
// lista se recorta a los últimos MAX_AVISOS.
export function agregarAviso(lista: Aviso[], a: Aviso): Aviso[] {
  if (lista.some((x) => x.id === a.id)) return lista;
  return [a, ...lista].sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, MAX_AVISOS);
}

export const sinLeer = (lista: Aviso[]) => lista.filter((a) => !a.leido).length;

// Marca como leído uno (por id) o todos (sin id).
export const marcarLeidos = (lista: Aviso[], id?: string): Aviso[] => lista.map((a) => (id === undefined || a.id === id ? { ...a, leido: true } : a));

// Un aviso a partir de una notificación del sistema. `date` viene en segundos en iOS y en milisegundos en Android: se normaliza.
export function deNotificacion(n: { date: number; request: { identifier: string; content: { title: string | null; body: string | null; data?: Record<string, unknown> } } }): Aviso {
  const ms = n.date < 1e12 ? n.date * 1000 : n.date;
  const quoteId = n.request.content.data?.quoteId;
  return {
    id: `${n.request.identifier}@${Math.round(ms / 1000)}`,
    titulo: n.request.content.title ?? 'Aviso',
    cuerpo: n.request.content.body ?? '',
    quoteId: typeof quoteId === 'string' ? quoteId : null,
    fecha: new Date(ms).toISOString(),
    leido: false,
  };
}
