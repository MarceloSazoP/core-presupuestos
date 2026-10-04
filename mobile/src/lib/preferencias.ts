// Parte pura de la preferencia de tema (sin React Native), para poder probarla.
export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';
export const esPreferencia = (v: unknown): v is PreferenciaTema => v === 'sistema' || v === 'claro' || v === 'oscuro';
