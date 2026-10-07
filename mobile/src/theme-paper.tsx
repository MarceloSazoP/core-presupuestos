import { View, type ViewStyle } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import type { Settings } from 'react-native-paper/lib/typescript/core/settings';
import type { Tema } from '@/theme';

// Tema de React Native Paper (Material Design 3) hecho con los colores de la app (`theme.ts`): Material cambia los componentes
// (tarjetas con elevación, tabla, onda al tocar), no la identidad. Las superficies elevadas de MD3 se tiñen con el color primario;
// aquí no: en claro son del color de la tarjeta (la sombra marca la altura) y en oscuro, donde la sombra no se ve sobre el fondo, cada
// nivel es un poco más claro que el anterior (la «elevación tonal» de Material), hacia el color del texto para no perder el tinte azul.
export function temaPaper(t: Tema): MD3Theme {
  const base = t.oscuro ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.acento,
      onPrimary: t.sobreAcento,
      primaryContainer: `${t.acento}26`,
      onPrimaryContainer: t.acento,
      secondary: t.acento,
      onSecondary: t.sobreAcento,
      secondaryContainer: `${t.acento}26`,
      onSecondaryContainer: t.texto,
      background: t.fondo,
      onBackground: t.texto,
      surface: t.tarjeta,
      onSurface: t.texto,
      surfaceVariant: t.campo,
      onSurfaceVariant: t.suave,
      outline: t.bordeCampo,
      outlineVariant: t.borde,
      error: t.error,
      elevation: t.oscuro
        ? { level0: 'transparent', level1: mezcla(t.tarjeta, t.texto, 0.05), level2: mezcla(t.tarjeta, t.texto, 0.08), level3: mezcla(t.tarjeta, t.texto, 0.11), level4: mezcla(t.tarjeta, t.texto, 0.12), level5: mezcla(t.tarjeta, t.texto, 0.14) }
        : { level0: 'transparent', level1: t.tarjeta, level2: t.tarjeta, level3: t.tarjeta, level4: t.tarjeta, level5: t.tarjeta },
    },
  };
}

// En oscuro las superficies elevadas llevan además un borde fino, apenas más claro que ellas, que dibuja el canto de la tarjeta sobre el
// fondo. En claro no hace falta: se ve la sombra.
export function bordeElevado(t: Tema): ViewStyle | null {
  return t.oscuro ? { borderWidth: 1, borderColor: 'rgba(238, 242, 250, 0.10)' } : null;
}

// Mezcla dos colores #RRGGBB: `p` es cuánto del segundo (0 a 1).
function mezcla(a: string, b: string, p: number): string {
  const canal = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * p).toString(16).padStart(2, '0')).join('')}`;
}

// La app no instala una librería de íconos: cada componente de Paper recibe el ícono propio (`Icono`) como función. Si alguno pidiera un
// ícono por nombre, queda un hueco del mismo tamaño (como hace `Icono` cuando falta uno), nunca el aviso de Paper ni un cuadro vacío.
export const ajustesPaper: Settings = {
  icon: ({ size }) => <View style={{ width: size, height: size }} />,
};
