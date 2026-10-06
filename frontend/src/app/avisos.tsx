"use client";

import { useEffect, useSyncExternalStore } from "react";

// Avisos que caen desde arriba para decir qué pasó (error, listo, ojo o dato). Son un refuerzo visual: el mensaje en la página
// se queda donde estaba (con su role="alert"/"status"), así que quien no ve el aviso no pierde nada.
type Tipo = "error" | "exito" | "aviso" | "info";
type Aviso = { id: number; tipo: Tipo; titulo: string; texto?: string; saliendo?: boolean };

const DURACION: Record<Tipo, number> = { error: 6500, aviso: 5500, exito: 4200, info: 4500 };
const MAX = 3;
let lista: Aviso[] = [];
let siguiente = 1;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());

function cerrar(id: number) {
  lista = lista.map((a) => (a.id === id ? { ...a, saliendo: true } : a));
  emitir();
  setTimeout(() => {
    lista = lista.filter((a) => a.id !== id);
    emitir();
  }, 220);
}

export function avisar(tipo: Tipo, titulo: string, texto?: string) {
  const repetido = lista.find((a) => a.tipo === tipo && a.titulo === titulo && a.texto === texto && !a.saliendo);
  if (repetido) lista = lista.filter((a) => a.id !== repetido.id);
  const id = siguiente++;
  lista = [...lista, { id, tipo, titulo, texto }].slice(-MAX);
  emitir();
  setTimeout(() => cerrar(id), DURACION[tipo]);
}

const suscribir = (f: () => void) => (oyentes.add(f), () => void oyentes.delete(f));

const ICONO: Record<Tipo, React.ReactNode> = {
  error: <path d="M12 8v5m0 3.5h.01M10.3 3.9 2.7 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  aviso: <path d="M12 8v5m0 3.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />,
  exito: <path d="m8 12.5 3 3 5-6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />,
  info: <path d="M12 11v5m0-8.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />,
};

// Capa fija arriba y centrada; no tapa lo de abajo (solo las tarjetas reciben clics).
export function Avisos() {
  const avisos = useSyncExternalStore(suscribir, () => lista, () => lista);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === "error" ? "alert" : "status"}
          data-tipo={a.tipo}
          data-saliendo={a.saliendo ? "" : undefined}
          className="aviso pointer-events-auto relative w-full max-w-md overflow-hidden rounded-xl border border-borde bg-card"
        >
          <div className="flex items-start gap-3 p-3.5">
            <span className="aviso-icono grid size-9 shrink-0 place-items-center rounded-full">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONO[a.tipo]}
              </svg>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-semibold leading-snug">{a.titulo}</p>
              {a.texto && <p className="mt-0.5 text-sm leading-snug text-muted [overflow-wrap:anywhere]">{a.texto}</p>}
            </div>
            <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" className="boton-icono -m-1.5 !min-h-9 !min-w-9 shrink-0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <span className="aviso-barra" style={{ animationDuration: `${DURACION[a.tipo]}ms` }} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

// Para avisar con cada respuesta nueva de una acción del servidor: `estado` es un objeto nuevo cada vez, aunque el texto se repita.
export function useAvisar(estado: unknown, decir: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(decir, [estado]);
}
