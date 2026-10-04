import { useColorScheme } from 'react-native';

// Colores de la marca (los mismos de la web): azul de acción, neutros con tinte azul, claro y oscuro. Los pares
// texto/fondo cumplen contraste ≥ 4,5:1. El color de acento se usa poco (60/30/10).
const claro = {
  fondo: '#FBFCFE',
  tarjeta: '#F2F4F9',
  borde: '#DDE1EA',
  texto: '#14171F',
  suave: '#5A6272',
  acento: '#1D4ED8',
  sobreAcento: '#FFFFFF',
  aviso: '#8A5A00',
  ok: '#1A7F37',
  seguimiento: '#7C3AED', // violeta: el estado «Seguimiento» tiene su propio color
  error: '#CF222E',
} as const;

const oscuro = {
  fondo: '#0B0D12',
  tarjeta: '#14171F',
  borde: '#262B36',
  texto: '#F1F3F8',
  suave: '#A5ACBA',
  acento: '#8FA8FF',
  sobreAcento: '#0B0D12',
  aviso: '#E3B341',
  ok: '#56D364',
  seguimiento: '#B197FC',
  error: '#FF7B72',
} as const;

export type Tema = { [K in keyof typeof claro]: string };

export const useTema = (): Tema => (useColorScheme() === 'dark' ? oscuro : claro);

// Escala de 8 pt y tamaños de letra (máximo 4 tamaños y 2 pesos, como pide la guía de diseño).
export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const letra = { chico: 13, cuerpo: 16, subtitulo: 20, titulo: 28 } as const;
export const MIN_TOQUE = 48; // ≥ 44 pt (iOS) y 48 dp (Android)
