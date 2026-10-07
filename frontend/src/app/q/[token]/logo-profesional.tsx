"use client";

import Box from "@mui/material/Box";
import { useState } from "react";

// El logo en su propia fila, pegado a la izquierda y con su proporción (los horizontales se ven enteros). Sobre fondo oscuro va en
// una placa blanca, porque casi todos se diseñan para fondo claro. Si no carga, no se muestra (nunca una imagen rota).
export function LogoProfesional({ src, nombre }: { src: string; nombre: string }) {
  const [roto, setRoto] = useState(false);
  if (roto) return null;
  return (
    <Box sx={(t) => ({ display: "flex", alignSelf: "flex-start", maxWidth: "100%", ...t.applyStyles("dark", { bgcolor: "common.white", borderRadius: 1, px: 1, py: 0.5 }) })}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen del profesional servida por el BFF; su proporción es la del logo */}
      <img src={src} alt={`Logo de ${nombre}`} onError={() => setRoto(true)} style={{ display: "block", height: 64, width: "auto", maxWidth: "min(20rem, 100%)", objectFit: "contain", objectPosition: "left center" }} />
    </Box>
  );
}
