// Fotos y notas de voz de la visita. Son internas: no salen en el PDF ni en la vista pública.
type Props = { fotos: string[]; audios: { id: string; segundos: number }[] };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function Multimedia({ fotos, audios }: Props) {
  if (fotos.length === 0 && audios.length === 0) return null;
  return (
    <section aria-labelledby="multimedia" className="flex flex-col gap-3 @3xl:col-span-2">
      <h3 id="multimedia" className="etiqueta uppercase tracking-wide text-muted">
        Fotos y notas de voz <span className="font-normal normal-case">(internas, no salen en el PDF)</span>
      </h3>
      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {fotos.map((id, i) => (
            <li key={id}>
              <a href={`/presupuesto/archivo/${id}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF; no hay nada que optimizar */}
                <img src={`/presupuesto/archivo/${id}`} alt={`Foto ${i + 1} de la visita`} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {audios.map((a, i) => (
        <div key={a.id} className="flex flex-col gap-1">
          <span className="text-sm text-muted">
            Nota de voz {i + 1} · {mmss(a.segundos)}
          </span>
          <audio controls preload="none" src={`/presupuesto/archivo/${a.id}`} className="w-full" />
        </div>
      ))}
    </section>
  );
}
