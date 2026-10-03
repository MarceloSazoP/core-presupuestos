"use client";

import { useEffect, useState } from "react";

const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "full" });
const hora = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", timeStyle: "medium", hourCycle: "h23" });

// Se dibuja solo en el navegador: el servidor y el cliente nunca coincidirían en el segundo exacto.
export function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setAhora(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col sm:items-end" aria-live="off">
      <time dateTime={ahora?.toISOString()} className="text-2xl font-semibold tabular-nums leading-none">
        {ahora ? hora.format(ahora) : "--:--:--"}
      </time>
      <span className="mt-1 block text-sm text-muted first-letter:uppercase">{ahora ? fecha.format(ahora) : " "}</span>
    </div>
  );
}
