"use client";

import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

const fecha = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" });
const hora = new Intl.DateTimeFormat("es-CL", { timeStyle: "short", hourCycle: "h23" });

// Se dibuja solo en el navegador: el servidor y el cliente nunca coincidirían en el segundo exacto. Hereda el color de la barra.
export function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setAhora(new Date());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Typography component="p" variant="body2" aria-live="off" sx={{ opacity: 0.9, fontVariantNumeric: "tabular-nums", "&::first-letter": { textTransform: "uppercase" } }}>
      {ahora ? (
        <>
          {fecha.format(ahora)} · <time dateTime={ahora.toISOString()}>{hora.format(ahora)}</time>
        </>
      ) : (
        " "
      )}
    </Typography>
  );
}
