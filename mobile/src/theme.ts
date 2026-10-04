import { useColorScheme } from 'react-native';

// La misma paleta que la web (pasada de OKLCH a hex): página apenas gris y tarjetas blancas, como papel sobre la mesa; azul de
// tinta para la acción; y la copia amarilla del talonario para lo que es solo del profesional (las notas de la visita).
// Pares verificados: texto y suave ≥ 4,5:1 sobre tarjeta, página y campo; borde de campo ≥ 3:1 contra el campo (WCAG 1.4.11).
const claro = {
  fondo: '#F5F7F9',
  tarjeta: '#FFFFFF',
  campo: '#F5F7F9', // relleno de los campos: un hueco gris sobre la tarjeta blanca
  borde: '#DBDEE4', // divisiones y tarjetas
  bordeCampo: '#82868F', // 3,4:1 contra el campo
  texto: '#181B20',
  suave: '#535861',
  acento: '#2C5DBD',
  sobreAcento: '#FFFFFF',
  aviso: '#8A5A00',
  ok: '#1A7F37',
  seguimiento: '#7C3AED', // violeta: el estado «Seguimiento» tiene su propio color
  error: '#CF222E',
  notaFondo: '#FFF7D5',
  notaBorde: '#E4D094',
  notaSello: '#724D0B',
} as const;

const oscuro = {
  fondo: '#090A0D',
  tarjeta: '#121418',
  campo: '#171A1E',
  borde: '#2D3037',
  bordeCampo: '#686C75', // 3,3:1 contra el campo
  texto: '#ECEEF3',
  suave: '#A0A5AE',
  acento: '#87B1FD',
  sobreAcento: '#090A0D',
  aviso: '#E3B341',
  ok: '#56D364',
  seguimiento: '#B197FC',
  error: '#FF7B72',
  notaFondo: '#241D0D',
  notaBorde: '#4E411D',
  notaSello: '#E8C773',
} as const;

export type Color = keyof typeof claro;
export type Tema = { [K in Color]: string } & { oscuro: boolean };

const TEMA_CLARO: Tema = { ...claro, oscuro: false };
const TEMA_OSCURO: Tema = { ...oscuro, oscuro: true };
export const useTema = (): Tema => (useColorScheme() === 'dark' ? TEMA_OSCURO : TEMA_CLARO);

// Escala de 8 pt y tamaños de letra (máximo 4 tamaños y 2 pesos, como pide la guía de diseño).
export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const letra = { chico: 13, cuerpo: 16, subtitulo: 20, titulo: 28 } as const;
export const radio = { s: 10, m: 14, l: 20 } as const;
export const MIN_TOQUE = 48; // ≥ 44 pt (iOS) y 48 dp (Android)
// Cifras y códigos: monoespaciada del sistema (el código del presupuesto se dicta letra por letra).
export const MONO = { ios: 'Menlo', android: 'monospace', default: 'monospace' } as const;
