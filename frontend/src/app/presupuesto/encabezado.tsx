import { salirAction } from "../actions";
import { BotonTema } from "../boton-tema";
import { Reloj } from "../reloj";

type Profesional = { nombre: string; telefono: string; correo: string };

// Dueño del presupuesto (usuario de la app móvil): logo, nombre y contacto, con la fecha y hora en vivo.
export function Encabezado({ profesional, logoSrc }: { profesional: Profesional; logoSrc: string | null }) {
  const telefono = profesional.telefono.replace(/[^\d+]/g, "");
  return (
    <header className="flex flex-col gap-4 border-b border-borde pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        {/* El logo va en su propia fila, encima del nombre: un logo horizontal se ve entero y sin deformarse. */}
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF; su proporción es la del logo
          <img src={logoSrc} alt={`Logo de ${profesional.nombre}`} className="h-16 w-auto max-w-full self-start object-contain object-left" />
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
      <div className="flex items-center gap-4">
        <Reloj />
        <BotonTema />
        <form action={salirAction}>
          <button type="submit" className="boton-secundario" title="Consultar otro presupuesto">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
