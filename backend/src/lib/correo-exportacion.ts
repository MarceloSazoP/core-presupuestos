import { aviso, correoCorporativo, parrafo } from './plantilla-correo';

// El correo que lleva el Excel con los datos de la persona (docs/Exportar y eliminar la cuenta.md §1).
export const correoExportacion = (nombre: string) =>
  correoCorporativo({
    preheader: 'Adjuntamos un Excel con todos tus datos.',
    titulo: `Hola ${nombre}`,
    cuerpo:
      parrafo('Pediste una copia de tus datos. Adjuntamos un archivo <strong>Excel</strong> con:') +
      parrafo('Tu cuenta, tus clientes, tus presupuestos con sus ítems, las notas y medidas de cada visita, y los seguimientos.') +
      aviso('Las <strong>fotos, notas de voz y PDF</strong> no van dentro del archivo, porque el correo pesaría demasiado: descárgalos desde cada presupuesto en la app.') +
      parrafo('Si no pediste esta copia, cambia el acceso a tu correo: quien lo tenga puede recibirla.', { suave: true }),
  });
