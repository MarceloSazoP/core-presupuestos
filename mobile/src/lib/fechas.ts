const dos = (n: number) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' de hoy + `dias`, en la fecha local del teléfono (el servidor valida "hoy o futura" en la zona horaria del usuario, que es la del teléfono).
export const enDias = (dias: number, desde = new Date()) => {
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + dias);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// Hasta cuándo vale un presupuesto: el día en que se terminó (en el teléfono) más su validez; `vencido` si ese día ya pasó.
export function vencimiento(terminadoIso: string, dias: number, hoy = new Date()) {
  const fecha = enDias(dias, new Date(terminadoIso));
  return { fecha, vencido: fecha < enDias(0, hoy) };
}

// El día que eligió la persona en el calendario (en la hora local del teléfono), como 'YYYY-MM-DD'.
export const aFechaLocal = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// '2026-10-12' → '12 oct'
export const diaCorto = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

// Cuánto hace de una fecha y hora ISO, por días del teléfono: 'hoy', 'ayer', 'hace 3 días' (hasta 6) o 'el 12 oct' (con el año si no es este).
export function haceCuanto(iso: string, ahora = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000); // redondeado: un día con cambio de horario no dura 24 horas
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  const fecha = `el ${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === ahora.getFullYear() ? fecha : `${fecha} ${d.getFullYear()}`;
}
