import { api } from '@/api/client';
import type { Cliente } from '@/api/types';
import { separarTelefono } from '@/lib/paises';
import { formatearTelefono } from '@/lib/telefono';
import { guardarKv, leerKv } from '@/sync/db';

// Clientes guardados (Arquitectura §5, «Clientes recurrentes y contactos»): se piden al servidor de a 100 (el máximo de la API) y se
// guarda la lista en el teléfono (`clientes`), así se buscan y se eligen también sin señal. `guardada`: viene de esa copia.
const POR_PAGINA = 100;
const MAX_PAGINAS = 10; // ponytail: hasta 1.000 clientes; con más, buscar en el servidor (`?q=`) en vez de traerlos todos

export async function cargarClientes(): Promise<{ lista: Cliente[]; guardada: boolean }> {
  try {
    const lista: Cliente[] = [];
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const { data } = await api<{ data: Cliente[] }>(`/customers?limit=${POR_PAGINA}&offset=${pagina * POR_PAGINA}`);
      lista.push(...data);
      if (data.length < POR_PAGINA) break;
    }
    void guardarKv('clientes', JSON.stringify(lista));
    return { lista, guardada: false };
  } catch {
    return { lista: (JSON.parse((await leerKv('clientes')) ?? '[]') as Cliente[] | null) ?? [], guardada: true };
  }
}

// «+56 9 1234 5678»: el teléfono guardado (E.164) como se lee, con el código de país y el número en sus grupos.
export function telefonoLegible(telefono: string) {
  const { codigo, nacional } = separarTelefono(telefono, '');
  return codigo ? `${codigo} ${formatearTelefono(nacional, codigo)}` : telefono;
}

// Las iniciales para el círculo del cliente («María José Soto» → «MS»): la primera y la última palabra.
export function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1]![0] : '')).toUpperCase() || '?';
}

// Un teléfono traído de Contactos o de un cliente guardado, partido como lo pide el campo: el código de país y el número nacional.
// Uno completo («+56 9 1234 5678») se limpia antes; uno local queda con el país propuesto.
export const telefonoParaCampo = (texto: string, codigoPropuesto: string) =>
  separarTelefono(texto.trim().startsWith('+') ? `+${texto.replace(/\D/g, '')}` : texto, codigoPropuesto);
