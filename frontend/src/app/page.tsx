import { ConsultaForm } from "./consulta-form";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-wide text-muted">CorePresupuesto</p>
        <h1 className="text-3xl font-semibold leading-tight">No olvides nada de lo que viste en terreno.</h1>
      </header>

      <ConsultaForm />
    </main>
  );
}
