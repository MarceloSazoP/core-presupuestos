// Esqueleto con la forma de la pantalla: título, «De la visita», la hoja del presupuesto y, en pantallas anchas, el resumen a la
// derecha. Evita el salto de layout mientras carga el presupuesto.
export default function Cargando() {
  return (
    <main className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10" aria-busy="true" aria-label="Cargando presupuesto">
      <div className="esqueleto h-14 w-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start xl:gap-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="esqueleto h-9 w-80 max-w-full" />
            <div className="esqueleto h-5 w-96 max-w-full" />
          </div>
          <div className="esqueleto h-36 w-full" />
          <div className="flex flex-col gap-8 rounded-xl border border-borde bg-card p-5 sm:p-8">
            <div className="flex flex-col gap-2">
              <div className="esqueleto h-4 w-20" />
              <div className="esqueleto h-6 w-48 max-w-full" />
            </div>
            <div className="esqueleto h-20 w-full" />
            <div className="esqueleto h-32 w-full" />
            <div className="esqueleto h-24 w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-borde bg-card p-5 sm:p-6">
          <div className="esqueleto h-5 w-24" />
          <div className="esqueleto h-24 w-full" />
          <div className="esqueleto h-11 w-full" />
        </div>
      </div>
    </main>
  );
}
