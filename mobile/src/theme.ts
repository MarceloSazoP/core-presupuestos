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
  serie1: '#0E3578', // gráfico: lo presupuestado (azul; es dato, no identidad)
  serie2: '#E3A008', // gráfico: lo aceptado (amarillo; en blanco pierde contraste, por eso las barras llevan la leyenda)
  // Las cuatro tarjetas del resumen: cada una con su tono (fondo suave + número en el tono oscuro; ≥ 7:1).
  kpi1Fondo: '#E3EBFA', kpi1Tinta: '#0E3578', // azul: esperando respuesta
  kpi2Fondo: '#FFEFC9', kpi2Tinta: '#7A4B00', // ámbar: por terminar o enviar
  kpi3Fondo: '#DDF3E4', kpi3Tinta: '#14602B', // verde: aceptado
  kpi4Fondo: '#EDE5FD', kpi4Tinta: '#5B21B6', // violeta: aceptación
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
  serie1: '#7C9CFF', // gráfico: lo presupuestado (azul suave, 6,6:1 sobre la tarjeta)
  serie2: '#F9890D', // gráfico: lo aceptado (naranja de la marca, 6,9:1; complementario del azul)
  kpi1Fondo: '#17306A', kpi1Tinta: '#9DBBFF',
  kpi2Fondo: '#3D2812', kpi2Tinta: '#FFB454',
  kpi3Fondo: '#10382A', kpi3Tinta: '#7BE39B',
  kpi4Fondo: '#2D2257', kpi4Tinta: '#CDBBFF',
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
