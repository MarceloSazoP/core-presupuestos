import type { z } from 'zod';

// Los esquemas de cada ruta son `.strict()`: un campo desconocido es un 422 (Contrato API §12). El manejador de
// errores convierte el ZodError en el formato del contrato.
export const parse = <T extends z.ZodType>(schema: T, data: unknown): z.infer<T> => schema.parse(data);
