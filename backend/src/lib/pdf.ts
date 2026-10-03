import { createRequire } from 'node:module';
import path from 'node:path';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { unitSymbol } from '../modules/quotes/units';
import type { Snapshot } from './snapshot';

type Pdfmake = {
  setFonts(fonts: unknown): void;
  setUrlAccessPolicy(policy: (url: string) => boolean): void;
  setLocalAccessPolicy(policy: (path: string) => boolean): void;
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

const nodeRequire = createRequire(__filename);
let engine: Pdfmake | null = null;

function pdfmake(): Pdfmake {
  if (engine) return engine;
  const p = nodeRequire('pdfmake') as Pdfmake;
  const fontsDir = path.dirname(nodeRequire.resolve('pdfmake/fonts/Roboto'));
  p.setFonts(nodeRequire('pdfmake/fonts/Roboto'));
  // Sin descargas ni lectura de archivos desde el contenido del usuario: solo las fuentes propias (Arquitectura §3).
  p.setUrlAccessPolicy(() => false);
  p.setLocalAccessPolicy((f) => path.resolve(f).startsWith(fontsDir));
  engine = p;
  return p;
}

// Puntos de miles y coma decimal, sin depender del ICU del servidor (es-CL no agrupa los miles de 4 cifras).
const miles = (digits: string) => digits.replace(/B(?=(d{3})+(?!d))/g, '.');
const clp = (n: number) => `$${miles(String(Math.round(n)))}`;
const qty = (n: number) => {
  const [int = '0', dec] = String(n).split('.');
  return miles(int) + (dec ? `,${dec}` : '');
};
const dayMonthYear = (iso: string) => iso.split('-').reverse().join('-'); // YYYY-MM-DD → DD-MM-YYYY
const issued = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });

export type Image = { data: Buffer; mime: string };
const dataUrl = (i: Image) => `data:${i.mime};base64,${i.data.toString('base64')}`;

// Recibe el SNAPSHOT y las imágenes ya leídas; no toca la BD ni el disco (Arquitectura §3, PDF y QR).
export function buildPdf(s: Snapshot, img: { logo?: Image; signature?: Image; qr?: Buffer } = {}): Promise<Buffer> {
  const totalRow = (label: string, value: string, bold = false): Content => ({
    columns: [
      { text: label, width: '*', alignment: 'right', bold },
      { text: value, width: 90, alignment: 'right', bold },
    ],
    margin: [0, 2, 0, 0],
  });

  const def: TDocumentDefinitions = {
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    info: { title: `Presupuesto ${s.number}` },
    content: [
      {
        columnGap: 10,
        columns: [
          ...(img.logo ? [{ image: dataUrl(img.logo), fit: [48, 48] } as Content] : []),
          {
            width: '*',
            stack: [
              { text: s.professional.name, fontSize: 14, bold: true },
              { text: `${s.professional.phone} · ${s.professional.email}`, color: '#555555' },
            ],
          },
          { text: `Presupuesto ${s.number}\nFecha: ${issued(s.finalized_at)}`, alignment: 'right', bold: true, width: 'auto' },
        ],
      },
      { text: `Cliente: ${s.customer.name}`, margin: [0, 18, 0, 4] },
      ...(s.service_address ? [{ text: `Dirección del servicio: ${s.service_address}`, margin: [0, 0, 0, 4] } as Content] : []),
      { text: `Servicio: ${s.service_description}`, margin: [0, 0, 0, 14] },
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
            ...s.items.map((i) => [
              i.description,
              { text: qty(i.quantity), alignment: 'right' as const },
              { text: unitSymbol(i.unit), alignment: 'center' as const },
              { text: clp(i.unit_price), alignment: 'right' as const },
              { text: clp(i.line_total), alignment: 'right' as const },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      },
      {
        margin: [0, 10, 0, 0],
        stack: [
          totalRow('Subtotal', clp(s.subtotal)),
          ...(s.discount > 0 ? [totalRow('Descuento', `-${clp(s.discount)}`)] : []),
          totalRow('TOTAL', clp(s.total), true),
        ],
      },
      { text: `Garantía: ${s.warranty.text}`, margin: [0, 18, 0, 2] },
      { text: `Validez: ${s.validity_days} días (hasta el ${dayMonthYear(s.valid_until)})`, margin: [0, 0, 0, 2] },
      ...(s.observations ? [{ text: `Observaciones: ${s.observations}`, margin: [0, 8, 0, 0] } as Content] : []),
      ...(img.signature ? [{ image: dataUrl(img.signature), fit: [120, 60], margin: [0, 24, 0, 0] } as Content] : []),
      ...(img.qr ? [{ image: `data:image/png;base64,${img.qr.toString('base64')}`, fit: [80, 80], margin: [0, 16, 0, 0] } as Content] : []),
      { text: 'Presupuesto comercial. No es un documento tributario.', fontSize: 8, color: '#666666', margin: [0, 30, 0, 0] },
    ],
  };
  return pdfmake().createPdf(def).getBuffer();
}
