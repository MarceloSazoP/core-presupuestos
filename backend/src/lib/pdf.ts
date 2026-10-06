import path from 'node:path';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { unitSymbol } from '../modules/quotes/units';
import { formatoMonto, ZONA_POR_DEFECTO } from './paises';
import type { Snapshot } from './snapshot';

type Pdfmake = {
  setFonts(fonts: unknown): void;
  setUrlAccessPolicy(policy: (url: string) => boolean): void;
  setLocalAccessPolicy(policy: (path: string) => boolean): void;
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

// pdfmake no parte una palabra sin espacios: una glosa larga sin cortes se salía de la hoja y se comía los bordes y las columnas.
// Se le da un punto de corte invisible cada 24 caracteres seguidos.
const cortable = (t: string) => t.replace(/\S{24}/g, '$&​');

let engine: Pdfmake | null = null;

function pdfmake(): Pdfmake {
  if (engine) return engine;
  // `require` con texto literal (no `createRequire`): así el empaquetado de Vercel detecta pdfmake y lo incluye en la función.
  const p = require('pdfmake') as Pdfmake;
  const fontsDir = path.dirname(require.resolve('pdfmake/fonts/Roboto'));
  p.setFonts(require('pdfmake/fonts/Roboto'));
  // Sin descargas ni lectura de archivos desde el contenido del usuario: solo las fuentes propias (Arquitectura §3).
  p.setUrlAccessPolicy(() => false);
  p.setLocalAccessPolicy((f) => path.resolve(f).startsWith(fontsDir));
  engine = p;
  return p;
}

// Puntos de miles y coma decimal en las cantidades (las del dinero, por moneda, en `formatoMonto`).
const miles = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const clp = (n: number) => formatoMonto(n, 'CLP');
const qty = (n: number) => {
  const [int = '0', dec] = String(n).split('.');
  return miles(int) + (dec ? `,${dec}` : '');
};
const dayMonthYear = (iso: string) => iso.split('-').reverse().join('-'); // YYYY-MM-DD → DD-MM-YYYY
// Fecha de emisión: la fijada en el snapshot (en la zona de quien emitió); los snapshots anteriores a los varios países solo traen la hora.
const issued = (s: Snapshot) => (s.issued_on ? dayMonthYear(s.issued_on) : new Date(s.finalized_at).toLocaleDateString('es-CL', { timeZone: s.timezone ?? ZONA_POR_DEFECTO }));

const GENERADO_POR = 'Generado por CORE Presupuestos v1.0';

export type Image = { data: Buffer; mime: string };
const dataUrl = (i: Image) => `data:${i.mime};base64,${i.data.toString('base64')}`;

// Recibe el SNAPSHOT y las imágenes ya leídas; no toca la BD ni el disco (Arquitectura §3, PDF y QR).
export function buildPdf(s: Snapshot, img: { logo?: Image; signature?: Image; qr?: Buffer; preview?: boolean } = {}): Promise<Buffer> {
  const dinero = (n: number) => formatoMonto(n, s.currency ?? 'CLP');
  const totalRow = (label: string, value: string, bold = false): Content => ({
    columns: [
      { text: label, width: '*', alignment: 'right', bold },
      { text: value, width: 90, alignment: 'right', bold },
    ],
    margin: [0, 2, 0, 0],
  });

  const def: TDocumentDefinitions = {
    pageMargins: [40, 40, 40, 50],
    // Pie discreto en cada página: quién generó el documento (no compite con el contenido del presupuesto).
    footer: { text: GENERADO_POR, alignment: 'center', fontSize: 7, color: '#9a9a9a', margin: [40, 12, 40, 0] },
    ...(img.preview && { watermark: { text: 'VISTA PREVIA', color: '#b42318', opacity: 0.1, bold: true } }),
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    info: { title: `Presupuesto ${s.number}${(s.version ?? 1) > 1 ? ` · Versión ${s.version}` : ''}` },
    content: [
      // El logo va en su propia fila, encima del nombre: así un logo horizontal se ve entero (cabe en 240 × 70 pt sin deformarse).
      ...(img.logo ? [{ image: dataUrl(img.logo), fit: [240, 70], margin: [0, 0, 0, 10] } as Content] : []),
      {
        columnGap: 10,
        columns: [
          {
            width: '*',
            stack: [
              { text: s.professional.name, fontSize: 14, bold: true },
              { text: `${s.professional.phone} · ${s.professional.email}`, color: '#555555' },
            ],
          },
          {
            // La 2.ª o 3.ª versión de un presupuesto rechazado lo dice y nombra al que reemplaza.
            text: [
              `Presupuesto ${s.number}${(s.version ?? 1) > 1 ? ` · Versión ${s.version}` : ''}\n`,
              ...(s.previous_number ? [{ text: `Reemplaza al presupuesto ${s.previous_number}\n`, fontSize: 8, bold: false, color: '#555555' }] : []),
              `Fecha: ${issued(s)}`,
            ],
            alignment: 'right',
            bold: true,
            width: 'auto',
          },
        ],
      },
      { text: `Cliente: ${cortable(s.customer.name)}`, margin: [0, 18, 0, 4] },
      ...(s.service_address ? [{ text: `Dirección del servicio: ${s.service_address}`, margin: [0, 0, 0, 4] } as Content] : []),
      { text: `Servicio: ${cortable(s.service_description)}`, margin: [0, 0, 0, 14] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 36, 46, 66, 76],
          body: [
            [
              { text: 'Descripción', bold: true },
              { text: 'Cant.', bold: true, alignment: 'right' },
              { text: 'Unidad', bold: true, alignment: 'center' },
              { text: 'Precio', bold: true, alignment: 'right' },
              { text: 'Total', bold: true, alignment: 'right' },
            ],
            // Una tarea no lleva cantidad, unidad ni precio unitario; con valor 0 se presenta como «Incluido».
            ...s.items.map((i) =>
              i.kind === 'TASK'
                ? [
                    { text: [{ text: 'TAREA  ', fontSize: 7, bold: true, color: '#666666' }, cortable(i.description)] },
                    { text: '', alignment: 'right' as const },
                    { text: '', alignment: 'center' as const },
                    { text: '', alignment: 'right' as const },
                    { text: i.line_total > 0 ? dinero(i.line_total) : 'Incluido', alignment: 'right' as const },
                  ]
                : [
                    cortable(i.description),
                    { text: qty(i.quantity), alignment: 'right' as const },
                    { text: unitSymbol(i.unit), alignment: 'center' as const },
                    { text: dinero(i.unit_price), alignment: 'right' as const },
                    { text: dinero(i.line_total), alignment: 'right' as const },
                  ],
            ),
          ],
        },
        layout: 'lightHorizontalLines',
      },
      {
        margin: [0, 10, 0, 0],
        stack: [
          totalRow('Subtotal', dinero(s.subtotal)),
          ...(s.discount > 0 ? [totalRow('Descuento', `-${dinero(s.discount)}`)] : []),
          ...(s.include_vat ? [totalRow(`${s.vat_label ?? 'IVA'} (${s.vat_rate ?? 19}%)`, dinero(s.vat ?? 0))] : []),
          totalRow('TOTAL', dinero(s.total), true),
        ],
      },
      { text: `Garantía: ${s.warranty.text}`, margin: [0, 18, 0, 2] },
      { text: `Validez: ${s.validity_days} días (hasta el ${dayMonthYear(s.valid_until)})`, margin: [0, 0, 0, 2] },
      ...(s.observations ? [{ text: `Observaciones: ${cortable(s.observations)}`, margin: [0, 8, 0, 0] } as Content] : []),
      // Bloque de firma: una línea y, debajo, «Firma:» con el nombre o negocio, su teléfono y su correo. Sale siempre (también sirve
      // para firmar a mano); la imagen de la firma va sobre la línea solo si el presupuesto la incluye.
      {
        unbreakable: true,
        margin: [0, 30, 0, 0],
        stack: [
          ...(img.signature ? [{ image: dataUrl(img.signature), fit: [170, 60], margin: [0, 0, 0, 2] }] : [{ text: ' ', margin: [0, 0, 0, 36] }]),
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 230, y2: 0, lineWidth: 0.8, lineColor: '#333333' }] },
          { text: [{ text: 'Firma: ', bold: true }, s.professional.name], margin: [0, 4, 0, 1] },
          { text: `${s.professional.phone} · ${s.professional.email}`, color: '#555555', fontSize: 9 },
        ],
      } as Content,
      ...(img.qr ? [{ image: `data:image/png;base64,${img.qr.toString('base64')}`, fit: [80, 80], margin: [0, 16, 0, 0] } as Content] : []),
      { text: 'Presupuesto comercial. No es un documento tributario.', fontSize: 8, color: '#666666', margin: [0, 30, 0, 0] },
    ],
  };
  return pdfmake().createPdf(def).getBuffer();
}
