"use client";

import { useLayoutEffect } from "react";

// Portada: lo marcado con `.revelar` aparece al llegar a la pantalla (globals.css), una sola vez por elemento: volver a animarlo cada
// vez que se sube y se baja sería pelear con quien lee. Lo que ya está a la vista al cargar se muestra tal cual, sin esconderlo un
// instante (por eso es useLayoutEffect, antes de pintar). Con «reducir movimiento», o sin JavaScript, todo se ve desde el principio.
export function Revelar() {
  useLayoutEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const raiz = document.documentElement;
    const mostrar = (e: Element) => e.setAttribute("data-visible", "");
    const elementos = [...document.querySelectorAll(".revelar")];
    for (const e of elementos) if (e.getBoundingClientRect().top < innerHeight) mostrar(e);
    raiz.setAttribute("data-revelar", "");
    // Al mostrar uno se muestran también los de más arriba: con un scroll rápido el vigía puede saltarse alguno y nada debe quedar
    // escondido sobre lo que ya se ve.
    const vigia = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          if (!en.isIntersecting) continue;
          for (const e of elementos.slice(0, elementos.indexOf(en.target) + 1)) {
            if (e.hasAttribute("data-visible")) continue;
            mostrar(e);
            vigia.unobserve(e);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" }, // aparece ya dentro de la pantalla, no justo en el borde
    );
    for (const e of elementos) if (!e.hasAttribute("data-visible")) vigia.observe(e);
    return () => {
      vigia.disconnect();
      raiz.removeAttribute("data-revelar");
    };
  }, []);
  return null;
}
