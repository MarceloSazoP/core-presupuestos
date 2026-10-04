import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

// Mantiene una pantalla al día con lo que cambia en otro lugar (p. ej. la web): vuelve a pedir los datos al volver a la app y cada
// pocos segundos mientras la pantalla está a la vista. Quien lo usa decide qué hacer si no hubo cambios.
export function useRefrescar(refrescar: () => void, cadaMs = 8000) {
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(refrescar, cadaMs);
      const s = AppState.addEventListener('change', (e) => e === 'active' && refrescar());
      return () => {
        clearInterval(t);
        s.remove();
      };
    }, [refrescar, cadaMs]),
  );
}
