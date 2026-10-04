'use server';

import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { clp } from '@/lib/formato';
import { codigoGarantia, mensajesDeError, type QuoteApi } from '@/lib/mapeo';
import { abrirSesion, cerrarSesion, sesionActual } from '@/lib/sesion';
import { enlaceWhatsApp, mensajePresupuesto } from '@/lib/whatsapp';

// La web no tiene reglas propias: valida lo mínimo para dar buenos mensajes y deja que la API decida (CLAUDE.md §6).

export type EstadoConsulta = { error?: string };

// El código lo crea la app móvil y la API lo canjea por una sesión limitada a ese presupuesto (Contrato API §9).
// La API responde el mismo 404 para un código inexistente, equivocado o revocado, y limita los intentos.
export async function consultarAction(_previo: EstadoConsulta, datos: FormData): Promise<EstadoConsulta> {
  const codigo = String(datos.get('codigo') ?? '').trim();
  if (codigo.length < 8 || codigo.length > 64) return { error: 'El código no es válido. Revisa que esté completo.' };
  try {
    const r = await api<{ token: string; quote_id: string; expires_at: string }>('/access/code/exchange', { method: 'POST', body: { code: codigo } });
    await abrirSesion(r.quote_id, r.token, r.expires_at);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) return { error: 'No existe un presupuesto con ese código.' };
      if (e.status === 429) return { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' };
      if (e.status === 422) return { error: 'El código no es válido. Revisa que esté completo.' };
      return { error: e.message };
    }
    throw e;
  }
  redirect('/presupuesto');
}

export async function salirAction(): Promise<void> {
  await cerrarSesion();
  redirect('/');
}

// WhatsApp se abre en el teléfono (sin API de WhatsApp Business): se avisa a la API cuando la persona lo pulsa.
export async function marcarEnviadoAction(canal: 'WHATSAPP' | 'SHARE' | 'LINK'): Promise<void> {
  const s = await sesionActual();
  if (!s) return;
  await api(`/quotes/${s.quoteId}/mark-sent`, { token: s.token, method: 'POST', body: { channel: canal } }).catch(() => {});
}

export type EstadoCorreo = { ok?: boolean; mensaje?: string };

export async function enviarCorreoAction(_previo: EstadoCorreo, datos: FormData): Promise<EstadoCorreo> {
  const s = await sesionActual();
  if (!s) return { mensaje: 'La sesión venció. Vuelve a consultar el presupuesto.' };
  const para = String(datos.get('para') ?? '').trim();
  try {
    await api(`/quotes/${s.quoteId}/send-email`, { token: s.token, method: 'POST', body: para ? { to: para } : {} });
    return { ok: true, mensaje: 'Enviado. Revisa la bandeja de entrada del cliente.' };
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 401) return { mensaje: 'La sesión venció. Vuelve a consultar el presupuesto.' };
    if (e.status === 429) return { mensaje: 'Demasiados envíos. Espera un rato e inténtalo de nuevo.' };
    return { mensaje: mensajesDeError(e.details, e.message).join(' ') };
  }
}

const aDecimal = (s: string) => Number(s.trim().replace(',', '.'));
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, ''));

export type EstadoEdicion = {
  errores?: string[];
  guardado?: string;
  terminado?: {
    numero: string;
    total: string;
    correo: { ok: boolean; mensaje: string };
    whatsappUrl: string;
  };
};

export async function completarPresupuestoAction(_previo: EstadoEdicion, datos: FormData): Promise<EstadoEdicion> {
  const s = await sesionActual();
  if (!s) return { errores: ['La sesión venció. Vuelve al inicio y escribe el código de nuevo.'] };
  const terminar = datos.get('accion') === 'terminar';

  const descripciones = datos.getAll('item_descripcion').map(String);
  const cantidades = datos.getAll('item_cantidad').map(String);
  const unidades = datos.getAll('item_unidad').map(String);
  const precios = datos.getAll('item_precio').map(String);

  // Al guardar se ignoran las filas totalmente vacías; al terminar, todas cuentan.
  const filas = descripciones
    .map((descripcion, i) => ({ descripcion, cantidad: cantidades[i] ?? '', unidad: unidades[i] ?? '', precio: precios[i] ?? '' }))
    .filter((f) => terminar || f.descripcion.trim() !== '' || f.precio.trim() !== '');
  if (filas.some((f) => !f.descripcion.trim() || !f.cantidad.trim() || !f.precio.trim())) {
    return { errores: ['Completa la descripción, la cantidad y el precio de cada ítem.'] };
  }
  if (filas.some((f) => !/^\d+([.,]\d{1,3})?$/.test(f.cantidad.trim()) || !/^[\d.\s$]*\d[\d.\s$]*$/.test(f.precio))) {
    return { errores: ['Revisa cantidades (hasta 3 decimales) y precios (solo números).'] };
  }
  const garantia = codigoGarantia(String(datos.get('garantia') ?? ''));
  const validez = Number(datos.get('validezDias'));
  if (!garantia || ![7, 15, 30].includes(validez)) return { errores: ['Elige la garantía y la validez del presupuesto.'] };

  const token = s.token;
  const base = `/quotes/${s.quoteId}`;
  try {
    await api(base, {
      token, method: 'PATCH',
      body: {
        service_description: String(datos.get('descripcion') ?? ''),
        address: String(datos.get('direccion') ?? '').trim() || null,
        discount: aEntero(String(datos.get('descuento') ?? '0')),
        include_vat: datos.get('iva') === '1',
        warranty: { kind: garantia },
        validity_days: validez,
        observations: String(datos.get('observaciones') ?? '').trim() || null,
      },
    });
    await api(base + '/items', {
      token, method: 'PUT',
      body: { items: filas.map((f) => ({ description: f.descripcion, quantity: aDecimal(f.cantidad), unit: f.unidad, unit_price: aEntero(f.precio) })) },
    });
    if (!terminar) {
      await api(base + '/save', { token, method: 'POST', body: {} });
      return { guardado: 'Guardado como pendiente. Puedes seguir después con el mismo código.' };
    }
    const q = await api<QuoteApi & { public_url: string }>(base + '/finalize', { token, method: 'POST', body: {} });
    // Terminar también envía el PDF por correo cuando el cliente tiene correo; si falla, el presupuesto queda cerrado igual.
    let correo = { ok: false, mensaje: 'El cliente no tiene correo: usa «Enviar a correo» e indica uno.' };
    if (q.customer.email) {
      try {
        await api(base + '/send-email', { token, method: 'POST', body: {} });
        correo = { ok: true, mensaje: `Enviado a ${q.customer.email}.` };
      } catch (e) {
        correo = { ok: false, mensaje: e instanceof ApiError ? mensajesDeError(e.details, e.message).join(' ') : 'No se pudo enviar el correo.' };
      }
    }
    const total = clp(q.total);
    return {
      terminado: {
        numero: q.number!,
        total,
        correo,
        whatsappUrl: enlaceWhatsApp(q.customer.phone, mensajePresupuesto({ nombre: q.customer.name, numero: q.number!, total, descripcion: q.service_description, enlace: q.public_url })),
      },
    };
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 401) return { errores: ['La sesión venció. Vuelve al inicio y escribe el código de nuevo.'] };
    if (e.status === 409) return { errores: ['El presupuesto ya está cerrado y no se puede modificar.'] };
    return { errores: mensajesDeError(e.details, e.message) };
  }
}
