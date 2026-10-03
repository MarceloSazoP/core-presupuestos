import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Almacenamiento seguro: Keychain en iOS (expo-secure-store). En web solo se usa para previsualizar la app en un
// navegador durante el desarrollo, y no hay Keychain: se usa localStorage.
const web = Platform.OS === 'web';

export const guardar = (clave: string, valor: string): Promise<void> => (web ? Promise.resolve(localStorage.setItem(clave, valor)) : SecureStore.setItemAsync(clave, valor));
export const leer = (clave: string): Promise<string | null> => (web ? Promise.resolve(localStorage.getItem(clave)) : SecureStore.getItemAsync(clave));
export const borrar = (clave: string): Promise<void> => (web ? Promise.resolve(localStorage.removeItem(clave)) : SecureStore.deleteItemAsync(clave));
