// Los datos con que la persona entró la última vez, guardados en el teléfono para sugerírselos la próxima vez (teléfono, correo y
// nombre; nunca un código ni una sesión). Lógica pura, sin React Native, para poder probarla.
export type UltimoAcceso = { prefijo: string; telefono: string; correo: string; nombre: string };

// Lo guardado puede venir de una versión anterior o estar dañado: solo se acepta con la forma esperada.
export function leerUltimoAcceso(texto: string | null): UltimoAcceso | null {
  if (!texto) return null;
  try {
    const v = JSON.parse(texto) as Partial<UltimoAcceso>;
    if ([v.prefijo, v.telefono, v.correo, v.nombre].some((x) => typeof x !== 'string')) return null;
    if (!/^\+\d{1,4}$/.test(v.prefijo!) || !v.telefono!.trim() || !v.correo!.includes('@')) return null;
    return { prefijo: v.prefijo!, telefono: v.telefono!, correo: v.correo!, nombre: v.nombre! };
  } catch {
    return null;
  }
}
