import { PAISES, PAIS_POR_DEFECTO } from './paises.ts';

// Zona horaria y región del teléfono (Internacionalización.md §3.4): de ahí salen «hoy», el mes y el país propuesto al registrarse.
export const zonaDelDispositivo = (): string | undefined => Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;

// El país de la región del teléfono (es-PE → Perú) si está en la lista; si no, Chile.
export function paisDelDispositivo() {
  const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-').pop()?.toUpperCase();
  return PAISES.find((p) => p.country === region) ?? PAIS_POR_DEFECTO;
}
