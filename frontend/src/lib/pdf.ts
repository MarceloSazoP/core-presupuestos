import 'server-only';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { clp, cant } from './formato';
import { simboloUnidad } from './opciones';
import type { Finalizado } from './presupuestos';
import { calcularTotales, totalLinea } from './totales';

type Pdfmake = {
  setFonts(fuentes: unknown): void;
  setUrlAccessPolicy(politica: (url: string) => boolean): void;
  setLocalAccessPolicy(politica: (ruta: string) => boolean): void;
  createPdf(definicion: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

// pdfmake queda fuera del bundle (next.config.ts) y se carga con require nativo, como en la prueba de arquitectura.
const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
let pdfmake: Pdfmake | null = null;

function motor(): Pdfmake {
  if (pdfmake) return pdfmake;
  const instancia = nodeRequire('pdfmake') as Pdfmake;
  const directorioFuentes = path.dirname(nodeRequire.resolve('pdfmake/fonts/Roboto'));
  instancia.setFonts(nodeRequire('pdfmake/fonts/Roboto'));
  // Sin descargas ni lectura de archivos desde el contenido: solo las fuentes propias.
  instancia.setUrlAccessPolicy(() => false);
  instancia.setLocalAccessPolicy((ruta) => path.resolve(ruta).startsWith(directorioFuentes));
  pdfmake = instancia;
  return instancia;
}

// Solo logos de la carpeta de demostración: la ruta nunca sale de public/demo.
async function logoSvg(url: string | null): Promise<string | null> {
  if (!url || !/^\/demo\/[\w.-]+\.svg$/.test(url)) return null;
  try {
    return await readFile(path.join(process.cwd(), 'public', url), 'utf8');
  } catch {
    return null;
  }
}

const fecha = (d: Date) => d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });

export async function generarPdf(p: Finalizado): Promise<Buffer> {
  const { subtotal, descuento, total } = calcularTotales(p.items, p.descuento);
  const creado = new Date(p.creadoEn);
  const vence = new Date(creado.getTime() + p.validezDias * 86_400_000);
  const { profesional } = p;
  const logo = await logoSvg(profesional.logoUrl);

  const filaTotal = (etiqueta: string, valor: string, negrita = false): Content => ({
    columns: [
      { text: etiqueta, width: '*', alignment: 'right', bold: negrita },
      { text: valor, width: 90, alignment: 'right', bold: negrita },
    ],
    margin: [0, 2, 0, 0],
  });

  const definicion: TDocumentDefinitions = {
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    info: { title: `Presupuesto ${p.numero}` },
    content: [
      {
        columnGap: 10,
        columns: [
          ...(logo ? [{ svg: logo, width: 44 } as Content] : []),
          {
            width: '*',
            stack: [
              { text: profesional.nombre, fontSize: 14, bold: true },
              { text: `${profesional.telefono} · ${profesional.correo}`, color: '#555555' },
            ],
          },
          { text: `Presupuesto ${p.numero}\nFecha: ${fecha(creado)}`, alignment: 'right', bold: true, width: 'auto' },
        ],
      },
      { text: `Cliente: ${p.cliente.nombre}`, margin: [0, 18, 0, 4] },
      { text: `Servicio: ${p.descripcion}`, margin: [0, 0, 0, 14] },
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
            ...p.items.map((i) => [
              i.descripcion,
              { text: cant(i.cantidad), alignment: 'right' as const },
              { text: simboloUnidad(i.unidad), alignment: 'center' as const },
              { text: clp(i.precioUnitario), alignment: 'right' as const },
              { text: clp(totalLinea(i.cantidad, i.precioUnitario)), alignment: 'right' as const },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      },
      { margin: [0, 10, 0, 0], stack: [
        filaTotal('Subtotal', clp(subtotal)),
        ...(descuento > 0 ? [filaTotal('Descuento', `-${clp(descuento)}`)] : []),
        filaTotal('TOTAL', clp(total), true),
      ] },
      { text: `Garantía: ${p.garantia}`, margin: [0, 18, 0, 2] },
      { text: `Validez: ${p.validezDias} días (hasta el ${fecha(vence)})`, margin: [0, 0, 0, 2] },
      ...(p.observaciones ? [{ text: `Observaciones: ${p.observaciones}`, margin: [0, 8, 0, 0] } as Content] : []),
      { text: 'Presupuesto comercial. No es un documento tributario.', fontSize: 8, color: '#666666', margin: [0, 30, 0, 0] },
    ],
  };

  return motor().createPdf(definicion).getBuffer();
}
