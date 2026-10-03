// Esqueleto con la forma de la pantalla: evita el salto de layout mientras carga el presupuesto.
export default function Cargando() {
  return (
    <main className="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:w-4/5 lg:px-0" aria-busy="true" aria-label="Cargando presupuesto">
      <div className="esqueleto h-20 w-full" />
      <div className="flex flex-col gap-2">
        <div className="esqueleto h-6 w-24 rounded-full" />
        <div className="esqueleto h-8 w-72 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <div className="esqueleto h-48 lg:row-span-2 xl:row-span-1" />
        <div className="flex flex-col gap-4">
          <div className="esqueleto h-16" />
          <div className="esqueleto h-56" />
          <div className="esqueleto h-32" />
        </div>
        <div className="esqueleto h-48 lg:col-start-2 xl:col-start-3 xl:row-start-1" />
      </div>
    </main>
  );
}
