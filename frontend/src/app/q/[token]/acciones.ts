"use server";

import { refresh } from "next/cache";
import { api, ApiError } from "@/lib/api";

export type EstadoAceptar = { listo?: boolean; correo?: boolean; error?: string };

// El cliente acepta su presupuesto (Contrato API §10). La API decide si todavía se puede; aquí solo se muestra lo que responde.
// `refresh` vuelve a dibujar la página: aparece el timbre «Aceptado».
export async function aceptarAction(token: string): Promise<EstadoAceptar> {
  try {
    const r = await api<{ confirmation_sent: boolean }>(`/public/quotes/${encodeURIComponent(token)}/accept`, { method: "POST" });
    refresh();
    return { listo: true, correo: r.confirmation_sent };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "No se pudo aceptar. Intenta de nuevo." };
  }
}
