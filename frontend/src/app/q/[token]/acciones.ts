"use server";

import { refresh } from "next/cache";
import { api, ApiError } from "@/lib/api";

export type EstadoAceptar = { listo?: boolean; error?: string };

// El cliente acepta su presupuesto (Contrato API §10). La API decide si todavía se puede; aquí solo se muestra lo que responde.
// `refresh` vuelve a dibujar la página: aparecen la confirmación arriba y el timbre «Aceptado».
export async function aceptarAction(token: string): Promise<EstadoAceptar> {
  try {
    await api(`/public/quotes/${encodeURIComponent(token)}/accept`, { method: "POST" });
    refresh();
    return { listo: true };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "No se pudo aceptar. Intenta de nuevo." };
  }
}
