// Borrador de «Lo que cobras» y las condiciones mientras se arman: queda en el teléfono (sin señal, o si la app se cierra) hasta
// guardarlo. Vale solo sobre la misma versión del servidor (`base`, la huella del cierre al abrirlo): si cambió en la web, manda la web.
export type BorradorCierre<F> = { base: string; filas: F[]; pct: number | null; conIva: boolean; dias: string; garantia: string; obs: string };

export const claveBorradorCierre = (quoteId: string) => `cierre:${quoteId}`;

export function borradorVigente<F>(guardado: string | null, base: string): BorradorCierre<F> | null {
  if (!guardado) return null;
  try {
    const b = JSON.parse(guardado) as BorradorCierre<F> | null;
    return b && b.base === base ? b : null;
  } catch {
    return null; // un borrador dañado no impide abrir el presupuesto
  }
}
