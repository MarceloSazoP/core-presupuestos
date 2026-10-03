"use client";

// Alterna claro/oscuro. Sin elección guardada manda el sistema; al pulsar se fija y se recuerda.
// No guarda estado: el ícono visible lo decide el CSS según el tema activo (ver .tema-sol / .tema-luna).
export function BotonTema() {
  const alternar = () => {
    const raiz = document.documentElement;
    const oscuro = (raiz.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    raiz.dataset.theme = oscuro ? "light" : "dark";
    try {
      localStorage.setItem("tema", raiz.dataset.theme);
    } catch {}
  };

  const icono = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  return (
    <button type="button" onClick={alternar} aria-label="Cambiar entre tema claro y oscuro" title="Cambiar tema" className="boton-icono border border-borde">
      <svg {...icono} className="tema-sol">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg {...icono} className="tema-luna">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
