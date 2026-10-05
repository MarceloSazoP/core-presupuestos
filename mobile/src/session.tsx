import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, configurarApi } from '@/api/client';
import type { Usuario } from '@/api/types';
import { borrar, guardar, leer } from '@/lib/almacen';
import { zonaDelDispositivo } from '@/lib/dispositivo';
import { recargarAvisos } from '@/lib/avisos';
import { usarDatosDe } from '@/sync/cola';

// La sesión vive en el almacenamiento seguro del teléfono (Keychain en iOS): el token y los datos del perfil, para
// poder abrir la app sin conexión. Si la API responde 401, la sesión venció o fue revocada y se cierra.
const K_TOKEN = 'token';
const K_USUARIO = 'usuario';

type Estado = 'cargando' | 'dentro' | 'fuera';
type Valor = { estado: Estado; usuario: Usuario | null; iniciar: (token: string, usuario: Usuario) => Promise<void>; actualizar: (usuario: Usuario) => Promise<void>; salir: () => Promise<void> };

const Contexto = createContext<Valor | null>(null);

export function useSesion(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return v;
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const token = useRef<string | null>(null);

  const salir = useCallback(async () => {
    const t = token.current;
    token.current = null;
    setUsuario(null);
    setEstado('fuera');
    await Promise.all([borrar(K_TOKEN), borrar(K_USUARIO)]);
    if (t) await api('/auth/logout', { method: 'POST', token: t }).catch(() => {}); // revoca la sesión en el servidor si hay red
  }, []);

  // Cambios en el perfil (nombre, contacto, logo): se guardan también para poder abrir la app sin conexión.
  const actualizar = useCallback(async (u: Usuario) => {
    setUsuario(u);
    await guardar(K_USUARIO, JSON.stringify(u));
  }, []);

  // La zona horaria es la del teléfono: si cambió (un viaje) o nunca se envió, se avisa al servidor, que la usa para «hoy» y el mes.
  const sincronizarZona = useCallback((u: Usuario, t?: string) => {
    const zona = zonaDelDispositivo();
    if (zona && u.timezone !== zona) api<Usuario>('/me', { method: 'PUT', body: { timezone: zona }, token: t }).then((fresco) => setUsuario(fresco)).catch(() => {});
  }, []);

  const iniciar = useCallback(async (t: string, u: Usuario) => {
    await Promise.all([guardar(K_TOKEN, t), guardar(K_USUARIO, JSON.stringify(u)), usarDatosDe(u.id)]);
    await recargarAvisos(); // los avisos son de cada cuenta: se vuelven a leer
    token.current = t;
    setUsuario(u);
    setEstado('dentro');
    sincronizarZona(u, t);
  }, [sincronizarZona]);

  useEffect(() => {
    configurarApi({ token: () => token.current, alVencer: () => void salir() });
    void (async () => {
      const [t, u] = await Promise.all([leer(K_TOKEN), leer(K_USUARIO)]);
      if (!t || !u) return setEstado('fuera');
      token.current = t;
      const guardado = JSON.parse(u) as Usuario;
      await usarDatosDe(guardado.id);
      await recargarAvisos();
      setUsuario(guardado);
      setEstado('dentro'); // entra de inmediato con lo guardado: en terreno puede no haber señal
      api<Usuario>('/me').then((fresco) => {
        setUsuario(fresco);
        sincronizarZona(fresco);
      }).catch(() => {}); // un 401 cierra la sesión (ver configurarApi)
    })();
  }, [salir, sincronizarZona]);

  return <Contexto.Provider value={{ estado, usuario, iniciar, actualizar, salir }}>{children}</Contexto.Provider>;
}
