export const GARANTIAS = ['Sin garantía', '7 días', '15 días', '30 días', '3 meses', '6 meses', '1 año'] as const;
export const VALIDEZ_DIAS = [7, 15, 30] as const;

type Def = readonly [codigo: string, simbolo: string, nombre: string];
const grupo = (nombre: string, defs: Def[]) => ({
  grupo: nombre,
  unidades: defs.map(([codigo, simbolo, nombre]) => ({ codigo, simbolo, nombre })),
});

// El código es estable y es lo que se guarda; el símbolo es lo que se muestra en el presupuesto y el PDF.
export const GRUPOS_UNIDAD = [
  grupo('Conteo y piezas', [
    ['un', 'un', 'unidad'],
    ['par', 'par', 'par'],
    ['juego', 'juego', 'juego'],
    ['kit', 'kit', 'kit'],
    ['doc', 'doc', 'docena'],
    ['pza', 'pza', 'pieza'],
    ['pto', 'pto', 'punto'],
    ['tramo', 'tramo', 'tramo'],
  ]),
  grupo('Envases y formatos', [
    ['caja', 'caja', 'caja'],
    ['bolsa', 'bolsa', 'bolsa'],
    ['saco', 'saco', 'saco'],
    ['rollo', 'rollo', 'rollo'],
    ['bobina', 'bobina', 'bobina'],
    ['plancha', 'plancha', 'plancha'],
    ['paquete', 'paquete', 'paquete'],
    ['tubo', 'tubo', 'tubo'],
    ['barra', 'barra', 'barra'],
    ['tarro', 'tarro', 'tarro'],
    ['balde', 'balde', 'balde'],
    ['tineta', 'tineta', 'tineta'],
  ]),
  grupo('Longitud', [
    ['mm', 'mm', 'milímetro'],
    ['cm', 'cm', 'centímetro'],
    ['m', 'm', 'metro'],
    ['ml', 'ml', 'metro lineal'],
    ['km', 'km', 'kilómetro'],
    ['plg', 'plg', 'pulgada'],
    ['pie', 'pie', 'pie'],
  ]),
  grupo('Superficie y volumen', [
    ['m2', 'm²', 'metro cuadrado'],
    ['m3', 'm³', 'metro cúbico'],
    ['l', 'l', 'litro'],
    ['gal', 'gal', 'galón'],
  ]),
  grupo('Peso', [
    ['g', 'g', 'gramo'],
    ['kg', 'kg', 'kilogramo'],
    ['ton', 'ton', 'tonelada'],
    ['lb', 'lb', 'libra'],
  ]),
  grupo('Tiempo y servicios', [
    ['hr', 'hr', 'hora'],
    ['hh', 'hh', 'hora hombre'],
    ['jornada', 'jornada', 'jornada'],
    ['dia', 'día', 'día'],
    ['semana', 'semana', 'semana'],
    ['mes', 'mes', 'mes'],
    ['visita', 'visita', 'visita'],
    ['servicio', 'servicio', 'servicio'],
    ['gl', 'gl', 'global'],
  ]),
];

export type Unidad = string;
export const UNIDADES = GRUPOS_UNIDAD.flatMap((g) => g.unidades);
export const UNIDAD_POR_DEFECTO: Unidad = 'un';

export const esUnidad = (codigo: string) => UNIDADES.some((u) => u.codigo === codigo);
export const simboloUnidad = (codigo: string) => UNIDADES.find((u) => u.codigo === codigo)?.simbolo ?? codigo;
export const textoUnidad = (u: { simbolo: string; nombre: string }) =>
  u.simbolo === u.nombre ? u.nombre : `${u.simbolo} — ${u.nombre}`;
