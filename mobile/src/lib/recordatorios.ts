// Qué recordatorios locales hay que tener programados (Arquitectura §5, "Recordatorios locales"). Función pura: decide,
// no programa. Los avisos se identifican por `contacto-<id>`, así programar de nuevo reemplaza al anterior.
export const PREFIJO = 'contacto-';
export const MAX_AVISOS = 60; // iOS admite 64 notificaciones pendientes por app; el resto se programa al acercarse
export const HORA_AVISO = 9;

type Resumen = { id: string; number: string | null; customer: { name: string }; commercial_status: string; next_contact_date: string | null };
export type Aviso = { identifier: string; quoteId: string; fecha: Date; titulo: string; cuerpo: string };

// 'YYYY-MM-DD' → ese día a las 09:00 en la hora del teléfono
export const fechaDelAviso = (dia: string) => new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)), HORA_AVISO, 0);

// Los avisos que YA debieron sonar según los presupuestos (su día a las 09:00 ya pasó), para la bandeja de avisos de la app. Aunque la
// persona haya borrado la notificación del teléfono sin tocarla, el aviso queda aquí. El id (`contacto-<id>@<día>`) es el mismo que
// el de la notificación del sistema, así que no se duplica y conserva si ya se leyó.
export function vencidos(quotes: Resumen[], ahora = new Date()) {
  return quotes
    .filter((q) => (q.commercial_status === 'SENT' || q.commercial_status === 'FOLLOW_UP') && q.next_contact_date)
    .map((q) => ({ q, fecha: fechaDelAviso(q.next_contact_date!) }))
    .filter(({ fecha }) => fecha <= ahora)
    .map(({ q, fecha }) => ({
      id: `${PREFIJO + q.id}@${q.next_contact_date}`,
      titulo: `Hoy: contactar a ${q.customer.name}`,
      cuerpo: q.number ? `Presupuesto ${q.number}. Llama o escribe para saber si lo revisó.` : 'Llama o escribe para saber si revisó el presupuesto.',
      quoteId: q.id,
      fecha: fecha.toISOString(),
      leido: false,
    }));
}

export function planificar(quotes: Resumen[], programadas: string[], ahora = new Date()): { programar: Aviso[]; cancelar: string[] } {
  const programar = quotes
    // aceptar o rechazar cierra el seguimiento; sin enviar no hay nada que recordar
    .filter((q) => (q.commercial_status === 'SENT' || q.commercial_status === 'FOLLOW_UP') && q.next_contact_date)
    .map((q) => ({
      identifier: PREFIJO + q.id,
      quoteId: q.id,
      fecha: fechaDelAviso(q.next_contact_date!),
      titulo: `Hoy: contactar a ${q.customer.name}`,
      cuerpo: q.number ? `Presupuesto ${q.number}. Llama o escribe para saber si lo revisó.` : 'Llama o escribe para saber si revisó el presupuesto.',
    }))
    .filter((a) => a.fecha > ahora)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .slice(0, MAX_AVISOS);
  const quedan = new Set(programar.map((a) => a.identifier));
  return { programar, cancelar: programadas.filter((id) => id.startsWith(PREFIJO) && !quedan.has(id)) };
}
