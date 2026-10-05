import { paisDelDispositivo } from '@/lib/dispositivo';
import { paisDe, type Pais } from '@/lib/paises';
import { useSesion } from '@/session';

// El país del usuario (moneda, impuesto, prefijo del teléfono). Sin usuario todavía (pantalla de ingreso), el de la región del teléfono.
export function usePais(): Pais {
  const { usuario } = useSesion();
  return usuario?.country ? paisDe(usuario.country) : paisDelDispositivo();
}
