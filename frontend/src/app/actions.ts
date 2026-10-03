'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizarCodigo } from '@/lib/codigo';
import { enviarPresupuesto, ErrorCorreo } from '@/lib/correo';
import { clp, enmascararCorreo } from '@/lib/formato';
import { permitir } from '@/lib/limite';
import { GARANTIAS } from '@/lib/opciones';
import { generarPdf } from '@/lib/pdf';
import {
  buscarPorCodigo,
  esFinalizado,
  finalizar,
  guardarBorrador,
  marcarCorreoEnviado,
  porId,
  type DatosEditables,
} from '@/lib/presupuestos';
import { abrirSesion, cerrarSesion, sesionActual } from '@/lib/sesion';
import { calcularTotales } from '@/lib/totales';
import { enlaceWhatsApp } from '@/lib/whatsapp';

const DIEZ_MINUTOS = 10 * 60_000;

// El encabezado solo es fiable detrás de un proxy propio; sirve como clave del límite de intentos.
async function origen(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export type EstadoConsulta = { error?: string };

const FORMATO_CODIGO = /^[a-z0-9][a-z0-9_-]{1,63}$/;

// El código lo crea la app móvil. Aquí solo se verifica; qué se puede hacer lo decide el estado del presupuesto.
export async function consultarAction(_previo: EstadoConsulta, datos: FormData): Promise<EstadoConsulta> {
  const codigo = normalizarCodigo(String(datos.get('codigo') ?? ''));
  if (!FORMATO_CODIGO.test(codigo)) return { error: 'El código no es válido. Revisa que esté completo.' };
  // Argon2 es costoso a propósito: se limita antes de verificar.
  if (!permitir(`consulta:${await origen()}`, 8, DIEZ_MINUTOS)) {
    return { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' };
  }
  const presupuesto = await buscarPorCodigo(codigo);
  if (!presupuesto) return { error: 'No existe un presupuesto con ese código.' };
  await abrirSesion(presupuesto.id);
  redirect('/presupuesto');
}

export async function salirAction(): Promise<void> {
  await cerrarSesion();
  redirect('/');
}

export type EstadoCorreo = { ok?: boolean; mensaje?: string };

export async function enviarCorreoAction(): Promise<EstadoCorreo> {
  const id = await sesionActual();
  if (!id) return { mensaje: 'La sesión venció. Vuelve a consultar el presupuesto.' };
  if (!permitir(`correo:${id}`, 5, DIEZ_MINUTOS)) return { mensaje: 'Demasiados envíos. Espera unos minutos.' };
  const presupuesto = await porId(id);
  if (!presupuesto || !esFinalizado(presupuesto)) return { mensaje: 'El presupuesto aún no está terminado.' };
  try {
    await enviarPresupuesto(presupuesto, await generarPdf(presupuesto));
    await marcarCorreoEnviado(id);
    return { ok: true, mensaje: `Enviado a ${enmascararCorreo(presupuesto.cliente.correo)}.` };
  } catch (err) {
    return { mensaje: err instanceof ErrorCorreo ? err.message : 'No se pudo enviar el correo.' };
  }
}

const aDecimal = (s: string) => Number(s.trim().replace(',', '.'));
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, ''));

const Item = z.object({
  descripcion: z.string().trim().min(1, 'Cada ítem necesita una descripción.').max(300, 'Una descripción es demasiado larga.'),
  cantidad: z.number().gt(0, 'La cantidad debe ser mayor que 0.').max(1_000_000, 'Una cantidad es demasiado grande.'),
  precioUnitario: z.number().int().min(0).max(999_999_999, 'Un precio es demasiado grande.'),
});
const Borrador = z.object({
  descripcion: z.string().trim().max(2000, 'La descripción del servicio es demasiado larga.'),
  items: z.array(Item).max(100, 'Máximo 100 ítems.'),
  descuento: z.number().int().min(0),
  garantia: z.enum(GARANTIAS),
  validezDias: z.union([z.literal(7), z.literal(15), z.literal(30)]),
  observaciones: z.string().trim().max(5000, 'Las observaciones son demasiado largas.').nullable(),
});
// Terminar exige un presupuesto emitible; guardar solo exige que lo escrito sea válido (Wizard §15.2).
const Completo = Borrador.extend({
  descripcion: z.string().trim().min(1, 'Describe el servicio.').max(2000),
  items: z.array(Item).min(1, 'Agrega al menos un ítem.').max(100),
});

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
  const id = await sesionActual();
  if (!id) return { errores: ['La sesión venció. Vuelve al inicio y escribe el código de nuevo.'] };
  if (!permitir(`editar:${id}`, 20, DIEZ_MINUTOS)) return { errores: ['Demasiados intentos. Espera unos minutos.'] };

  const actual = await porId(id);
  if (!actual) return { errores: ['No se encontró el presupuesto.'] };
  if (actual.estado !== 'PENDING') return { errores: ['El presupuesto ya está cerrado y no se puede modificar.'] };

  const terminar = datos.get('accion') === 'terminar';
  const descripciones = datos.getAll('item_descripcion').map(String);
  const cantidades = datos.getAll('item_cantidad').map(String);
  const precios = datos.getAll('item_precio').map(String);

  // Al guardar se ignoran las filas totalmente vacías; al terminar, todas cuentan.
  const filas = descripciones
    .map((descripcion, i) => ({ descripcion, cantidad: cantidades[i] ?? '', precio: precios[i] ?? '' }))
    .filter((f) => terminar || f.descripcion.trim() !== '' || f.precio.trim() !== '');
  if (filas.some((f) => !f.descripcion.trim() || !f.cantidad.trim() || !f.precio.trim())) {
    return { errores: ['Completa la descripción, la cantidad y el precio de cada ítem.'] };
  }
  const filasInvalidas = filas.some((f) => !/^\d+([.,]\d{1,3})?$/.test(f.cantidad.trim()) || !/^[\d.\s$]*\d[\d.\s$]*$/.test(f.precio));
  if (filasInvalidas) return { errores: ['Revisa cantidades (hasta 3 decimales) y precios (solo números).'] };

  const analizado = (terminar ? Completo : Borrador).safeParse({
    descripcion: String(datos.get('descripcion') ?? ''),
    items: filas.map((f) => ({ descripcion: f.descripcion, cantidad: aDecimal(f.cantidad), precioUnitario: aEntero(f.precio) })),
    descuento: aEntero(String(datos.get('descuento') ?? '0')),
    garantia: String(datos.get('garantia') ?? ''),
    validezDias: Number(datos.get('validezDias')),
    observaciones: String(datos.get('observaciones') ?? '').trim() || null,
  });
  if (!analizado.success) return { errores: [...new Set(analizado.error.issues.map((i) => i.message))] };

  const editable: DatosEditables = analizado.data;
  const { subtotal, total } = calcularTotales(editable.items, editable.descuento);
  if (editable.descuento > subtotal) return { errores: ['El descuento no puede superar el subtotal.'] };

  if (!terminar) {
    await guardarBorrador(id, editable);
    return { guardado: 'Guardado como pendiente. Puedes seguir después con el mismo código.' };
  }

  const finalizado = await finalizar(id, editable);
  if (!finalizado) return { errores: ['El presupuesto ya está cerrado y no se puede modificar.'] };

  let correo = { ok: false, mensaje: 'No se pudo enviar el correo.' };
  if (permitir(`correo:${id}`, 5, DIEZ_MINUTOS)) {
    try {
      await enviarPresupuesto(finalizado, await generarPdf(finalizado));
      await marcarCorreoEnviado(id);
      correo = { ok: true, mensaje: `Enviado a ${enmascararCorreo(finalizado.cliente.correo)}.` };
    } catch (err) {
      if (err instanceof ErrorCorreo) correo.mensaje = err.message;
    }
  }

  const mensaje =
    `Hola ${finalizado.cliente.nombre}, te envié el presupuesto ${finalizado.numero} por ${clp(total)} ` +
    `(${finalizado.descripcion}). El PDF va adjunto en tu correo.`;

  return {
    terminado: {
      numero: finalizado.numero,
      total: clp(total),
      correo,
      whatsappUrl: enlaceWhatsApp(finalizado.cliente.telefono, mensaje),
    },
  };
}
