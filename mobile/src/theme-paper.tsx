import { View } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import type { Settings } from 'react-native-paper/lib/typescript/core/settings';
import type { Tema } from '@/theme';

// Tema de React Native Paper (Material Design 3) hecho con los colores de la app (`theme.ts`): Material cambia los componentes
// (tarjetas con elevación, tabla, onda al tocar), no la identidad. Las superficies elevadas de MD3 se tiñen con el color primario;
// aquí se fijan en el color de la tarjeta para que se vean igual que el resto de la app.
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
      background: t.fondo,
      onBackground: t.texto,
      surface: t.tarjeta,
      onSurface: t.texto,
      surfaceVariant: t.campo,
      onSurfaceVariant: t.suave,
      outline: t.bordeCampo,
      outlineVariant: t.borde,
      error: t.error,
      elevation: { level0: 'transparent', level1: t.tarjeta, level2: t.tarjeta, level3: t.tarjeta, level4: t.tarjeta, level5: t.tarjeta },
    },
  };
}

// La app no instala una librería de íconos: cada componente de Paper recibe el ícono propio (`Icono`) como función. Si alguno pidiera un
// ícono por nombre, queda un hueco del mismo tamaño (como hace `Icono` cuando falta uno), nunca el aviso de Paper ni un cuadro vacío.
export const ajustesPaper: Settings = {
  icon: ({ size }) => <View style={{ width: size, height: size }} />,
};
