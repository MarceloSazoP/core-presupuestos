import Image from "next/image";
import type { Profesional } from "@/lib/presupuestos";
import { Reloj } from "../reloj";

// Dueño del presupuesto (usuario de la app móvil): logo, nombre y contacto, con la fecha y hora en vivo.
export function Encabezado({ profesional }: { profesional: Profesional }) {
  const telefono = profesional.telefono.replace(/[^\d+]/g, "");
  return (
    <header className="tarjeta flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {profesional.logoUrl && (
          <Image src={profesional.logoUrl} alt={`Logo de ${profesional.nombre}`} width={56} height={56} unoptimized className="size-14 shrink-0 rounded-xl" />
        )}
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-xl font-semibold leading-tight">{profesional.nombre}</p>
          <p className="flex flex-wrap gap-x-4 text-sm text-muted">
            <a href={`tel:${telefono}`} className="underline-offset-4 hover:underline">
              {profesional.telefono}
            </a>
            <a href={`mailto:${profesional.correo}`} className="break-all underline-offset-4 hover:underline">
              {profesional.correo}
            </a>
          </p>
        </div>
      </div>
      <Reloj />
    </header>
  );
}
