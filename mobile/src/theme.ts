import { useColorScheme } from 'react-native';

// Identidad de CORE Presupuestos, sacada del logo: azul marino (la C y las barras) como color de la acción y naranja (la flecha)
// como acento para lo que se quiere destacar. Los grises llevan un tinte azul, como el logo. En oscuro la acción pasa a naranja y
// las superficies son azul noche (el azul marino sobre oscuro no se lee). Pares verificados: texto, suave y acento ≥ 4,5:1 sobre
// tarjeta, página y campo; borde de campo ≥ 3:1 contra el campo (WCAG 1.4.11); texto sobre naranja 7:1.
const claro = {
  fondo: '#F3F5FA',
  tarjeta: '#FFFFFF',
  campo: '#F3F5FA', // relleno de los campos: un hueco gris sobre la tarjeta blanca
  borde: '#DDE3EE', // divisiones y tarjetas
  bordeCampo: '#7C879E', // 3,3:1 contra el campo
  texto: '#0B1B3A',
  suave: '#4F5B74',
  acento: '#0E3578', // azul marino de la marca: botones, pestaña elegida, enlaces
  sobreAcento: '#FFFFFF',
  naranja: '#F9890D', // naranja de la marca: solo para destacar (no para texto sobre blanco)
  sobreNaranja: '#0B1B3A',
  azul: '#0E3578', // el azul de la marca en gráficos (en oscuro uno más claro, para que se vea sobre azul noche)
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
  azul: '#5B84E6', // 4,7:1 sobre la tarjeta; distinto del naranja también en tono
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
