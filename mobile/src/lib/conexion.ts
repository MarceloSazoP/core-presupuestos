import { useNetworkState } from 'expo-network';

// ¿Sabe el teléfono, con certeza, que no hay señal? Mientras no se sabe, se asume que sí hay: la acción lo intenta y, si falla, avisa.
// En desarrollo solo cuenta «sin red»: la API puede estar en el mismo wifi sin salida a internet (p. ej. el punto de acceso del computador).
export function useSinSenal() {
  const { isConnected, isInternetReachable } = useNetworkState();
  return isConnected === false || (!__DEV__ && isInternetReachable === false);
}
