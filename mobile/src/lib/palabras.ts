export const palabrasDe = (s: string) => s.trim().split(/\s+/).filter(Boolean);
// Las primeras `max` palabras; si no se pasa del tope, el texto queda tal cual (con su espacio final, para poder seguir escribiendo).
export const recortarPalabras = (s: string, max: number) => (palabrasDe(s).length <= max ? s : palabrasDe(s).slice(0, max).join(' '));
