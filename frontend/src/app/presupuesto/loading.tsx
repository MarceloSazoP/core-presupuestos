// Esqueleto con la forma de la pantalla: una sola hoja (como el PDF) con cliente y visita arriba, servicio, ítems, y
// condiciones a la izquierda y resumen a la derecha. Evita el salto de layout mientras carga el presupuesto.
export default function Cargando() {
  return (
    <main className="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:w-4/5 lg:px-0" aria-busy="true" aria-label="Cargando presupuesto">
      <div className="esqueleto h-20 w-full" />
      <div className="@container flex flex-col gap-8 rounded-xl border border-borde bg-card p-5 sm:p-8 lg:p-10">
        <div className="flex items-baseline justify-between gap-2 border-b-2 border-borde pb-3">
          <div className="esqueleto h-8 w-48" />
          <div className="esqueleto h-6 w-24 rounded-full" />
        </div>

        <div className="grid gap-6 @3xl:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="esqueleto h-4 w-20" />
            <div className="esqueleto h-6 w-48 max-w-full" />
            <div className="esqueleto h-4 w-32" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="esqueleto h-4 w-40" />
            <div className="esqueleto h-12 w-full" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="esqueleto h-4 w-16" />
          <div className="esqueleto h-16 w-full" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="esqueleto h-4 w-16" />
          <div className="esqueleto h-48 w-full" />
        </div>

        <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:items-start">
          <div className="flex flex-col gap-4">
            <div className="esqueleto h-4 w-28" />
            <div className="grid gap-4 @xl:grid-cols-2">
              <div className="esqueleto h-12" />
              <div className="esqueleto h-12" />
            </div>
            <div className="esqueleto h-20 w-full" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="esqueleto h-4 w-20" />
            <div className="esqueleto h-28 w-full" />
            <div className="esqueleto h-12 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
