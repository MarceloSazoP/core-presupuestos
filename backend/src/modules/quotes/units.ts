// Catálogo de unidades del Contrato de API §12.1. Vive aquí (y no en la BD) para agregar una unidad sin migrar.
// El frontend tiene su propia copia: no hay paquete compartido (Arquitectura A16).
export const UNIT_CODES = [
  'un', 'par', 'juego', 'kit', 'doc', 'pza', 'pto', 'tramo',
  'caja', 'bolsa', 'saco', 'rollo', 'bobina', 'plancha', 'paquete', 'tubo', 'barra', 'tarro', 'balde', 'tineta',
  'mm', 'cm', 'm', 'ml', 'km', 'plg', 'pie',
  'm2', 'm3', 'l', 'gal',
  'g', 'kg', 'ton', 'lb',
  'hr', 'hh', 'jornada', 'dia', 'semana', 'mes', 'visita', 'servicio', 'gl',
] as const;

export const isUnit = (code: string) => (UNIT_CODES as readonly string[]).includes(code);

// Símbolo que se muestra en el PDF y la vista pública: el código, salvo estos tres.
const SYMBOLS: Record<string, string> = { m2: 'm²', m3: 'm³', dia: 'día' };
export const unitSymbol = (code: string) => SYMBOLS[code] ?? code;
