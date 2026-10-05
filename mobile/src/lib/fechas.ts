const dos = (n: number) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' de hoy + `dias`, en la fecha local del teléfono (el servidor valida "hoy o futura" en la zona horaria del usuario, que es la del teléfono).
export const enDias = (dias: number, desde = new Date()) => {
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + dias);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// El día que eligió la persona en el calendario (en la hora local del teléfono), como 'YYYY-MM-DD'.
export const aFechaLocal = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// '2026-10-12' → '12 oct'
export const diaCorto = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
