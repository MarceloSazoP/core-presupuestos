import { z } from 'zod';
import { email, name, phone } from '../auth/schemas';
import { hasMax3Decimals } from './totals';
import { isUnit } from './units';

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const optText = (max: number) => text(max).nullish();

export const Warranty = z
  .strictObject({
    kind: z.enum(['NONE', 'D7', 'D15', 'D30', 'M3', 'M6', 'Y1', 'CUSTOM']),
    text: text(500).nullish(),
  })
  .refine((w) => w.kind !== 'CUSTOM' || !!w.text, { path: ['text'], message: 'Escribe la garantía' });

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

const NewCustomer = z.strictObject({ name, phone, email: email.nullish(), address: optText(300) });

export const CreateQuote = z
  .strictObject({
    id: z.uuid().optional(),
    customer_id: z.uuid().optional(),
    customer: NewCustomer.optional(),
    service_description: optText(2000),
    address: optText(300),
    latitude: lat.nullish(),
    longitude: lng.nullish(),
  })
  .refine((b) => (b.customer_id === undefined) !== (b.customer === undefined), { path: ['customer_id'], message: 'Envía customer_id o customer, no ambos ni ninguno' })
  .refine((b) => (b.latitude == null) === (b.longitude == null), { path: ['latitude'], message: 'latitude y longitude van juntas o ninguna' });

export const PatchQuote = z
  .strictObject({
    customer_id: z.uuid(),
    service_description: text(2000).nullable(),
    address: text(300).nullable(),
    latitude: lat.nullable(),
    longitude: lng.nullable(),
    discount: z.number().int().min(0).max(999_999_999_999),
    include_vat: z.boolean(),
    warranty: Warranty,
    validity_days: z.number().int().min(1).max(365).nullable(),
    observations: text(5000).nullable(),
    include_qr: z.boolean(),
  })
  .partial()
  .refine((b) => ('latitude' in b) === ('longitude' in b), { path: ['latitude'], message: 'latitude y longitude van juntas' })
  .refine((b) => (b.latitude == null) === (b.longitude == null), { path: ['latitude'], message: 'latitude y longitude van juntas o ninguna' });

export const Survey = z.strictObject({ notes: text(10000).nullable(), field_observations: text(5000).nullable() }).partial();

const Short = z.string().trim().min(1, 'Obligatorio').max(60, 'Máximo 60 caracteres');
export const Measurements = z.strictObject({
  measurements: z.array(z.strictObject({ id: z.uuid().optional(), label: Short, value: Short })).max(50, 'Máximo 50 medidas'),
});

const Description = z.string().trim().min(1, 'Cada ítem necesita una descripción').max(300, 'Máximo 300 caracteres');
const UnitPrice = z.number().int().min(0).max(999_999_999, 'Demasiado grande');

// Una línea es un ítem (cantidad × precio) o una tarea (actividad sin cantidad ni unidad, Contrato API §6). Sin `kind` es
// un ítem, como antes. En una tarea `quantity` y `unit` no existen: el esquema estricto responde 422 si llegan.
const Line = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ITEM'),
    id: z.uuid().optional(),
    description: Description,
    quantity: z.number().gt(0, 'Debe ser mayor que 0').max(1_000_000, 'Demasiado grande').refine(hasMax3Decimals, 'Máximo 3 decimales'),
    unit: z.string().refine(isUnit, 'Unidad de medida no válida').default('un'),
    unit_price: UnitPrice,
  }),
  z.strictObject({ kind: z.literal('TASK'), id: z.uuid().optional(), description: Description, unit_price: UnitPrice.default(0) }),
]);
const withKind = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) && !('kind' in v) ? { ...v, kind: 'ITEM' } : v);

export const Items = z.strictObject({ items: z.array(z.preprocess(withKind, Line)).max(100, 'Máximo 100 ítems') });

export const ListQuotes = z.object({
  section: z.enum(['pending', 'follow_up', 'finalized']).optional(),
  doc_status: z.enum(['DRAFT', 'PENDING', 'FINALIZED']).optional(),
  commercial_status: z.enum(['NONE', 'SENT', 'FOLLOW_UP', 'ACCEPTED', 'REJECTED']).optional(),
  customer_id: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
