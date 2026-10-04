import { Appearance } from 'react-native';
import { guardar, leer } from '@/lib/almacen';

// Apariencia de la app: seguir al teléfono (por defecto) o fijar claro u oscuro. Es del teléfono, no del usuario: se guarda en el
// almacén seguro del dispositivo (no en la base local, que se vacía al cambiar de cuenta). `Appearance.setColorScheme` cambia
// también lo nativo (barra de estado, cabeceras, teclado); 'unspecified' vuelve a seguir al sistema.
import { esPreferencia, type PreferenciaTema } from '@/lib/preferencias';
export type { PreferenciaTema };
export const OPCIONES_TEMA: readonly { id: PreferenciaTema; texto: string }[] = [
  { id: 'sistema', texto: 'Automático' },
  { id: 'claro', texto: 'Claro' },
  { id: 'oscuro', texto: 'Oscuro' },
];

const ESQUEMA = { sistema: 'unspecified', claro: 'light', oscuro: 'dark' } as const;
const CLAVE = 'tema';

// En la versión web de desarrollo (el navegador) React Native no trae `setColorScheme`: ahí simplemente no hace nada.
export const aplicarTema = (p: PreferenciaTema) => {
  if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(ESQUEMA[p]);
};

export async function leerPreferenciaTema(): Promise<PreferenciaTema> {
  const v = await leer(CLAVE).catch(() => null);
  return esPreferencia(v) ? v : 'sistema';
}

export async function elegirTema(p: PreferenciaTema) {
  aplicarTema(p);
  await guardar(CLAVE, p).catch(() => {});
}
