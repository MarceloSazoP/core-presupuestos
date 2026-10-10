import { useColorScheme } from 'react-native';

// Identidad de CORE Presupuestos, sacada del logo. La acción (botones, pestaña elegida, enlaces) es el naranja de la flecha: quemado en
// claro, para que se lea sobre blanco, y el naranja de la marca en oscuro. El azul de la marca ya no tiñe las superficies: el claro es
// gris neutro y el azul queda para los datos (`info`, el gráfico, «esperando respuesta»). Colores definidos en OKLCH y pasados a hex.
// Pares verificados: texto, suave, acento e info ≥ 4,5:1 sobre tarjeta, página y campo; borde de campo ≥ 3:1 contra el campo
// (WCAG 1.4.11); texto blanco sobre el acento claro 5,7:1; texto sobre naranja 7:1.
const claro = {
  fondo: '#F6F6F6', // gris neutro (oklch 97 % sin tinte): antes todo el claro estaba teñido de azul
  tarjeta: '#FFFFFF',
  campo: '#F6F6F6', // relleno de los campos: un hueco gris sobre la tarjeta blanca
  borde: '#DFDFDF', // divisiones y tarjetas
  bordeCampo: '#878685', // 3,4:1 contra el campo
  texto: '#1A1816', // casi negro, 16:1 sobre la página
  suave: '#5D5A57', // 6,3:1 sobre la página
  acento: '#B83D00', // naranja quemado de la marca (oklch 53 % 0,175 45°): botones, pestaña elegida, enlaces; 5,7:1 sobre blanco y 4,9:1 sobre su propio tinte al 10 %
  sobreAcento: '#FFFFFF',
  naranja: '#F9890D', // naranja de la marca: solo para destacar (no para texto sobre blanco)
  sobreNaranja: '#1A1816',
  info: '#285CC2', // azul de dato: «Aceptado», información (6,2:1 sobre blanco)
  // El Inicio usa una sola línea de color, el azul de la marca, en sus matices (los datos no compiten con el naranja de las acciones):
  // las tarjetas del resumen en el azul más claro con la tinta en el más oscuro (11:1), y el gráfico en dos tonos del mismo azul,
  // claro para lo presupuestado y oscuro para lo aceptado (las barras ≥ 3:1 sobre blanco, WCAG 1.4.11, y la leyenda los nombra).
  datoFondo: '#EEF2FB',
  datoTinta: '#0E3578',
  serie1: '#6F8FD6', // gráfico: lo presupuestado (3,2:1 sobre la tarjeta)
  serie2: '#0E3578', // gráfico: lo aceptado
  totalFondo: '#DDF3E4', totalTinta: '#14602B', // verde dólar: ícono y palabras del cuadro del total (tinta sobre blanco ≈ 7:1)
  aviso: '#8A5A00',
  ok: '#1A7F37',
  seguimiento: '#7C3AED', // violeta: el estado «Seguimiento» tiene su propio color
  error: '#CF222E',
  notaFondo: '#FFF7D5',
  notaBorde: '#E4D094',
  notaSello: '#724D0B',
} as const;

const oscuro = {
  fondo: '#0A1226',
  tarjeta: '#111C38',
  campo: '#15213F',
  borde: '#243357',
  bordeCampo: '#6C7BA0', // 3,8:1 contra el campo
  texto: '#EEF2FA',
  suave: '#9AA7C2',
  acento: '#F9890D', // en oscuro la acción es el naranja de la marca
  sobreAcento: '#0B1B3A',
  naranja: '#F9890D',
  sobreNaranja: '#0B1B3A',
  info: '#8FB4FF', // azul de dato en oscuro
  datoFondo: '#16264D', // la misma línea azul en oscuro: tarjeta un poco más clara que la superficie y tinta clara (10:1)
  datoTinta: '#B9CCFF',
  serie1: '#4A69B3', // gráfico: lo presupuestado (3,2:1 sobre la tarjeta)
  serie2: '#9DBBFF', // gráfico: lo aceptado (8,7:1)
  totalFondo: '#10382A', totalTinta: '#7BE39B', // lo mismo en oscuro
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
