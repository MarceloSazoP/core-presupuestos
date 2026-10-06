import ExcelJS from 'exceljs';
import { query, withTx } from '../db';
import { removeMany } from './files';

// Exportar los datos de una persona y eliminar su cuenta (docs/Exportar y eliminar la cuenta.md).

type Fila = Record<string, unknown>;

function hoja(wb: ExcelJS.Workbook, nombre: string, columnas: [string, string, number][], filas: Fila[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = columnas.map(([header, key, width]) => ({ header, key, width }));
  ws.addRows(filas);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// El Excel con todo lo del usuario. Fotos, audios y PDF no van dentro (el correo pesaría demasiado): solo se cuentan.
export async function excelDeUsuario(userId: string): Promise<Buffer> {
  const [u, clientes, quotes, items, visita, medidas, seguimientos] = await Promise.all([
    query<Fila>('SELECT name, phone, email, country, timezone, contact_phone, contact_email, created_at FROM users WHERE id = $1', [userId]),
    query<Fila>('SELECT name, phone, email, address, created_at FROM customers WHERE user_id = $1 ORDER BY lower(name)', [userId]),
    query<Fila>(
      `SELECT q.number, q.version, q.doc_status, q.commercial_status, c.name AS customer, q.service_description, q.address, q.latitude::float8 AS latitude, q.longitude::float8 AS longitude,
              q.subtotal, q.discount, q.vat, q.total, q.currency, q.vat_label, q.warranty_kind, q.warranty_text, q.validity_days, q.observations,
              q.created_at, q.finalized_at, q.sent_at, q.accepted_at, q.next_contact_date,
              (SELECT count(*)::int FROM files f WHERE f.quote_id = q.id AND f.kind = 'PHOTO') AS photos,
              (SELECT count(*)::int FROM files f WHERE f.quote_id = q.id AND f.kind = 'VOICE') AS voice_notes
         FROM quotes q JOIN customers c ON c.id = q.customer_id AND c.user_id = q.user_id WHERE q.user_id = $1 ORDER BY q.created_at`, [userId]),
    query<Fila>(
      `SELECT coalesce(q.number, 'Borrador de ' || to_char(q.created_at, 'YYYY-MM-DD')) AS quote, i.position, i.kind, i.description, i.quantity::float8 AS quantity, i.unit, i.unit_price, i.line_total
         FROM quote_items i JOIN quotes q ON q.id = i.quote_id WHERE q.user_id = $1 ORDER BY q.created_at, i.position`, [userId]),
    query<Fila>(
      `SELECT coalesce(q.number, 'Borrador de ' || to_char(q.created_at, 'YYYY-MM-DD')) AS quote, s.notes, s.field_observations
         FROM quote_surveys s JOIN quotes q ON q.id = s.quote_id WHERE q.user_id = $1 ORDER BY q.created_at`, [userId]),
    query<Fila>(
      `SELECT coalesce(q.number, 'Borrador de ' || to_char(q.created_at, 'YYYY-MM-DD')) AS quote, m.position, m.label, m.value
         FROM survey_measurements m JOIN quotes q ON q.id = m.quote_id WHERE q.user_id = $1 ORDER BY q.created_at, m.position`, [userId]),
    query<Fila>(
      `SELECT coalesce(q.number, 'Borrador de ' || to_char(q.created_at, 'YYYY-MM-DD')) AS quote, f.created_at, f.commercial_status, f.note, f.next_contact_date
         FROM follow_ups f JOIN quotes q ON q.id = f.quote_id WHERE f.user_id = $1 ORDER BY f.created_at`, [userId]),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CORE Presupuestos';
  wb.created = new Date();
  const cuenta = u.rows[0]!;
  hoja(wb, 'Cuenta', [['Dato', 'k', 24], ['Valor', 'v', 46]], [
    ['Nombre', cuenta.name], ['Teléfono', cuenta.phone], ['Correo', cuenta.email], ['País', cuenta.country], ['Zona horaria', cuenta.timezone],
    ['Teléfono de contacto', cuenta.contact_phone], ['Correo de contacto', cuenta.contact_email], ['Cuenta creada', cuenta.created_at], ['Exportado el', new Date()],
  ].map(([k, v]) => ({ k, v })));
  hoja(wb, 'Clientes', [['Nombre', 'name', 28], ['Teléfono', 'phone', 18], ['Correo', 'email', 30], ['Dirección', 'address', 36], ['Creado', 'created_at', 20]], clientes.rows);
  hoja(wb, 'Presupuestos', [
    ['Número', 'number', 16], ['Versión', 'version', 9], ['Documento', 'doc_status', 13], ['Estado comercial', 'commercial_status', 17], ['Cliente', 'customer', 26], ['Trabajo', 'service_description', 40],
    ['Dirección', 'address', 32], ['Latitud', 'latitude', 11], ['Longitud', 'longitude', 11], ['Subtotal', 'subtotal', 13], ['Descuento', 'discount', 13], ['Impuesto', 'vat', 12], ['Total', 'total', 13],
    ['Moneda', 'currency', 9], ['Nombre del impuesto', 'vat_label', 12], ['Garantía', 'warranty_kind', 11], ['Texto de garantía', 'warranty_text', 24], ['Validez (días)', 'validity_days', 13], ['Observaciones', 'observations', 40],
    ['Creado', 'created_at', 20], ['Cerrado', 'finalized_at', 20], ['Enviado', 'sent_at', 20], ['Aceptado', 'accepted_at', 20], ['Próximo contacto', 'next_contact_date', 16], ['Fotos', 'photos', 8], ['Notas de voz', 'voice_notes', 12],
  ], quotes.rows);
  hoja(wb, 'Ítems', [['Presupuesto', 'quote', 24], ['N.º', 'position', 6], ['Tipo', 'kind', 8], ['Descripción', 'description', 44], ['Cantidad', 'quantity', 10], ['Unidad', 'unit', 10], ['Precio unitario', 'unit_price', 15], ['Total de la línea', 'line_total', 16]], items.rows);
  hoja(wb, 'Visita', [['Presupuesto', 'quote', 24], ['Notas', 'notes', 60], ['Observaciones de terreno', 'field_observations', 44]], visita.rows);
  hoja(wb, 'Medidas', [['Presupuesto', 'quote', 24], ['N.º', 'position', 6], ['Medida', 'label', 24], ['Valor', 'value', 20]], medidas.rows);
  hoja(wb, 'Seguimiento', [['Presupuesto', 'quote', 24], ['Fecha', 'created_at', 20], ['Estado', 'commercial_status', 16], ['Nota', 'note', 50], ['Próximo contacto', 'next_contact_date', 16]], seguimientos.rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Elimina la cuenta y TODO lo suyo, en una transacción; los archivos del disco se quitan después de confirmar (si algo falla antes, no se pierde nada).
// Orden: presupuestos (cascada a ítems, levantamiento, seguimientos, accesos y archivos), clientes (los presupuestos los retenían) y el usuario (cascada al resto).
export async function eliminarCuenta(userId: string): Promise<void> {
  const claves = await withTx(async (c) => {
    const files = (await c.query<{ storage_key: string }>('SELECT storage_key FROM files WHERE user_id = $1', [userId])).rows.map((f) => f.storage_key);
    await c.query('DELETE FROM quotes WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM customers WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM users WHERE id = $1', [userId]);
    return files;
  });
  await removeMany(claves);
}
