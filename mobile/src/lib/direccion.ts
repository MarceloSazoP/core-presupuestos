// Lógica pura de la dirección con mapa (docs/Ubicación y mapa.md). Sin React Native, para poder probarla.
export type Punto = { latitude: number; longitude: number };

// El punto se guarda con 6 decimales (≈ 10 cm): más no aporta y ensucia el dato.
export const redondear = (n: number) => Math.round(n * 1e6) / 1e6;
export const puntoDe = (latitude: number | null | undefined, longitude: number | null | undefined): Punto | null =>
  typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;

type Partes = { street?: string | null; streetNumber?: string | null; name?: string | null; district?: string | null; subregion?: string | null; city?: string | null };

// «calle número, comuna» a partir de lo que devuelve la geocodificación inversa del teléfono. Sin calle, usa el nombre del lugar; sin
// nada que mostrar, null (la persona escribe la dirección).
export function formatearDireccion(p: Partes | undefined): string | null {
  if (!p) return null;
  const calle = [p.street, p.streetNumber].filter(Boolean).join(' ') || p.name || '';
  const zona = p.district || p.subregion || p.city || '';
  const texto = [calle, zona].filter(Boolean).join(', ');
  return texto || null;
}

// Una sesión nueva por cada dirección que se escribe: agrupa las consultas de sugerencias y el detalle en una sola cobranza (Places).
export const sesionNueva = (uuid: string) => uuid.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 36);
