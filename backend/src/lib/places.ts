import { config } from '../config';
import { AppError } from '../errors';

// Sugerencias de direcciones con Places API (New) de Google, a través del backend para no poner la clave dentro de la app
// (docs/Ubicación y mapa.md §3). Sin clave, o ante cualquier falla del proveedor, `503 PLACES_UNAVAILABLE`: la app sigue sirviendo
// sin sugerencias.
export type Sugerencia = { id: string; text: string };
export type Lugar = { address: string; latitude: number; longitude: number };
export type Lugares = {
  autocomplete(input: string, region: string, session: string): Promise<Sugerencia[]>;
  details(id: string, session: string): Promise<Lugar>;
};

const noDisponible = () => new AppError(503, 'PLACES_UNAVAILABLE', 'Las sugerencias de direcciones no están disponibles.');
const BASE = 'https://places.googleapis.com/v1';

async function pedir(url: string, init: RequestInit): Promise<unknown> {
  const key = config.GOOGLE_PLACES_API_KEY;
  if (!key) throw noDisponible();
  try {
    const res = await fetch(url, { ...init, headers: { 'X-Goog-Api-Key': key, ...init.headers }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw noDisponible();
    return await res.json();
  } catch (e) {
    throw e instanceof AppError ? e : noDisponible();
  }
}

export const googleLugares: Lugares = {
  async autocomplete(input, region, session) {
    const r = (await pedir(`${BASE}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text' },
      body: JSON.stringify({ input, languageCode: 'es', includedRegionCodes: [region.toLowerCase()], sessionToken: session }),
    })) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
    return (r.suggestions ?? []).flatMap((s) => (s.placePrediction ? [{ id: s.placePrediction.placeId, text: s.placePrediction.text.text }] : [])).slice(0, 5);
  },
  async details(id, session) {
    const r = (await pedir(`${BASE}/places/${encodeURIComponent(id)}?languageCode=es&sessionToken=${encodeURIComponent(session)}`, {
      method: 'GET',
      headers: { 'X-Goog-FieldMask': 'formattedAddress,location' },
    })) as { formattedAddress?: string; location?: { latitude: number; longitude: number } };
    if (!r.location || typeof r.location.latitude !== 'number') throw noDisponible();
    return { address: r.formattedAddress ?? '', latitude: r.location.latitude, longitude: r.location.longitude };
  },
};
