'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { api, ApiError } from '@/lib/api';
import { clp } from '@/lib/formato';
import { codigoGarantia, mensajesDeError, type QuoteApi } from '@/lib/mapeo';
import { abrirSesion, cerrarSesion, sesionActual } from '@/lib/sesion';
import { esCorreo, normalizarTelefono } from '@/lib/telefono';
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

// QR por visita (Contrato API §9): el QR lleva solo un código de vínculo de un solo uso y 2 minutos. La página conserva el secreto de espera;
// la sesión que entrega la API va directo a la cookie httpOnly y nunca pasa por el JavaScript del navegador.
export type Vinculo = { id: string; secret: string; qr: string; expiraEn: string };

export async function crearVinculoAction(): Promise<Vinculo | { error: string }> {
  try {
    const r = await api<{ id: string; code: string; secret: string; expires_at: string }>('/access/pair', { method: 'POST', body: {} });
    const qr = await QRCode.toDataURL(`corepresupuesto://web/${r.code}`, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#1a1a1a', light: '#ffffff' } });
    return { id: r.id, secret: r.secret, qr, expiraEn: r.expires_at };
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return { error: 'Generaste muchos QR seguidos. Espera unos minutos o usa el código.' };
    if (e instanceof ApiError || e instanceof TypeError) return { error: 'No pudimos generar el QR.' };
    throw e;
  }
}

export async function esperarVinculoAction(id: string, secret: string): Promise<'esperando' | 'listo' | 'vencido'> {
  try {
    const r = await api<{ status: 'WAITING' | 'CLAIMED'; token?: string; quote_id?: string; expires_at?: string }>('/access/pair/poll', { method: 'POST', body: { id, secret } });
    if (r.status !== 'CLAIMED') return 'esperando';
    await abrirSesion(r.quote_id!, r.token!, r.expires_at!);
    return 'listo';
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return 'vencido';
    if (e instanceof ApiError || e instanceof TypeError) return 'esperando'; // un tropiezo de red o el límite: se vuelve a preguntar
    throw e;
  }
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
  vistaPrevia?: number; // el editor guardó y puede abrir la vista previa (marca de tiempo para distinguir cada pedido)
  terminado?: {
    numero: string;
    total: string;
    correo: { ok: boolean; mensaje: string };
    whatsappUrl: string;
  };
};

// Corregir el nombre, el teléfono y el correo del cliente (Contrato API §6). Teléfono y correo siempre se pueden, también con el presupuesto
// terminado (no están en el PDF ni en el snapshot); el nombre solo mientras se edita, y por eso solo llega desde el editor. El correo vacío significa «sin correo».
export async function corregirClienteAction(telefono: string, correo: string, nombre?: string): Promise<{ error?: string }> {
  const s = await sesionActual();
  if (!s) return { error: 'La sesión venció. Vuelve al inicio y escribe el código de nuevo.' };
  const tel = normalizarTelefono(telefono);
  if (!tel) return { error: 'Escribe un teléfono válido, por ejemplo 9 1234 5678.' };
  const mail = correo.trim().toLowerCase();
  const nom = nombre?.trim();
  if (nombre !== undefined && !nom) return { error: 'Escribe el nombre del cliente.' };
  if (mail && !esCorreo(mail)) return { error: 'Revisa el correo: parece incompleto.' };
  try {
    await api(`/quotes/${s.quoteId}/customer`, { token: s.token, method: 'PATCH', body: { phone: tel, email: mail || null, ...(nom && { name: nom }) } });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return { error: mensajesDeError(e.details, e.message).join(' ') };
  }
  revalidatePath('/presupuesto');
  return {};
}

// Editar las notas de la visita (Contrato API §6, Etapa 2). Solo mientras el presupuesto se puede editar. Vacío = sin notas.
export async function guardarNotasAction(notas: string): Promise<{ error?: string }> {
  const s = await sesionActual();
  if (!s) return { error: 'La sesión venció. Vuelve al inicio y escribe el código de nuevo.' };
  const texto = notas.trim();
  if (texto.length > 10000) return { error: 'Las notas son muy largas (máximo 10.000 caracteres).' };
  try {
    await api(`/quotes/${s.quoteId}/survey`, { token: s.token, method: 'PUT', body: { notes: texto || null } });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 409) return { error: 'El presupuesto ya está cerrado y no se puede modificar.' };
    return { error: mensajesDeError(e.details, e.message).join(' ') };
  }
  revalidatePath('/presupuesto');
  return {};
}

// Quitar una foto o una nota de voz del levantamiento (Contrato API §6). Solo mientras el presupuesto se puede editar.
export async function eliminarArchivoAction(tipo: 'foto' | 'audio', id: string): Promise<{ error?: string }> {
  const s = await sesionActual();
  if (!s) return { error: 'La sesión venció. Vuelve al inicio y escribe el código de nuevo.' };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Ese archivo no es válido.' };
  try {
    await api(`/quotes/${s.quoteId}/${tipo === 'foto' ? 'photos' : 'voice-notes'}/${id}`, { token: s.token, method: 'DELETE' });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 409) return { error: 'El presupuesto ya está cerrado y no se puede modificar.' };
    if (e.status === 404) return {}; // ya no estaba: el resultado es el mismo
    return { error: e.message };
  }
  revalidatePath('/presupuesto');
  return {};
}

export async function completarPresupuestoAction(_previo: EstadoEdicion, datos: FormData): Promise<EstadoEdicion> {
  const s = await sesionActual();
  if (!s) return { errores: ['La sesión venció. Vuelve al inicio y escribe el código de nuevo.'] };
  const terminar = datos.get('accion') === 'terminar';
  const previsualizar = datos.get('accion') === 'previsualizar'; // guarda igual que «Guardar» y deja abrir la vista previa

  const tipos = datos.getAll('item_tipo').map(String);
  const descripciones = datos.getAll('item_descripcion').map(String);
  const cantidades = datos.getAll('item_cantidad').map(String);
  const unidades = datos.getAll('item_unidad').map(String);
  const precios = datos.getAll('item_precio').map(String);

  // Las filas totalmente vacías se ignoran siempre (Enter en la grilla deja una fila en blanco al final).
  const filas = descripciones
    .map((descripcion, i) => ({ tarea: tipos[i] === 'tarea', descripcion, cantidad: cantidades[i] ?? '', unidad: unidades[i] ?? '', precio: precios[i] ?? '' }))
    .filter((f) => f.descripcion.trim() !== '' || f.precio.trim() !== '');
  // Una tarea (actividad sin cantidad ni unidad) solo necesita descripción; su precio es opcional (vacío = incluida).
  if (filas.some((f) => !f.descripcion.trim() || (!f.tarea && (!f.cantidad.trim() || !f.precio.trim())))) {
    return { errores: ['Completa la descripción, la cantidad y el precio de cada ítem, y la descripción de cada tarea.'] };
  }
  const precioValido = (p: string) => /^[\d.\s$]*\d[\d.\s$]*$/.test(p);
  if (filas.some((f) => (f.tarea ? f.precio.trim() !== '' && !precioValido(f.precio) : !/^\d+([.,]\d{1,3})?$/.test(f.cantidad.trim()) || !precioValido(f.precio)))) {
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
      body: {
        items: filas.map((f) =>
          f.tarea
            ? { kind: 'TASK', description: f.descripcion, unit_price: aEntero(f.precio) }
            : { kind: 'ITEM', description: f.descripcion, quantity: aDecimal(f.cantidad), unit: f.unidad, unit_price: aEntero(f.precio) },
        ),
      },
    });
    if (!terminar) {
      await api(base + '/save', { token, method: 'POST', body: {} });
      return previsualizar ? { vistaPrevia: Date.now() } : { guardado: 'Guardado como pendiente. Puedes seguir después con el mismo código.' };
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
