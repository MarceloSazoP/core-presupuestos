import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashCodigo, verificarCodigo } from './codigo';
import { UNIDAD_POR_DEFECTO, type Unidad } from './opciones';
import type { Item } from './totales';

// PROVISIONAL: almacén en un JSON local que imita lo que la app móvil entrega (código + levantamiento).
// Se reemplaza por la API (Contrato de API) sin tocar las pantallas: solo cambian las funciones de este archivo.
// Estados documentales como en el Contrato de BD: PENDING (editable) y FINALIZED (solo lectura).
export type ItemPresupuesto = Item & { unidad: Unidad };

export type Profesional = { nombre: string; telefono: string; correo: string; logoUrl: string | null };

export type Presupuesto = {
  id: string;
  numero: string | null;
  codigoHash: string;
  estado: 'PENDING' | 'FINALIZED';
  profesional: Profesional;
  cliente: { nombre: string; telefono: string; correo: string };
  descripcion: string;
  levantamiento: { notas: string | null; medidas: { etiqueta: string; valor: string }[] };
  items: ItemPresupuesto[];
  descuento: number;
  garantia: string;
  validezDias: number;
  observaciones: string | null;
  creadoEn: string;
  finalizadoEn: string | null;
  correoEnviadoEn: string | null;
};

export type Finalizado = Presupuesto & { numero: string };
export const esFinalizado = (p: Presupuesto): p is Finalizado => p.estado === 'FINALIZED' && p.numero !== null;

export type DatosEditables = Pick<Presupuesto, 'descripcion' | 'items' | 'descuento' | 'garantia' | 'validezDias' | 'observaciones'>;

const ARCHIVO = path.join(process.cwd(), '.data', 'presupuestos.json');

// Los datos personales de prueba salen de .env.local, no del código.
function cliente(): Presupuesto['cliente'] {
  return {
    nombre: process.env.DEV_CLIENT_NAME ?? 'Cliente de pruebas',
    telefono: process.env.DEV_CLIENT_PHONE ?? '',
    correo: process.env.DEV_CLIENT_EMAIL ?? '',
  };
}

// Datos del dueño del presupuesto (usuario de la app móvil). Provisional: en producción vienen de su perfil.
function profesionalDePrueba(): Profesional {
  return {
    nombre: process.env.DEV_PRO_NAME ?? 'Profesional de prueba',
    telefono: process.env.DEV_PRO_PHONE ?? '+56 9 0000 0000',
    correo: process.env.DEV_PRO_EMAIL ?? 'profesional@example.com',
    logoUrl: '/demo/logo-profesional.svg',
  };
}

const anioChile = () => new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', year: 'numeric' }).format(new Date());
const numeroDe = (n: number) => `CP-${anioChile()}-${String(n).padStart(4, '0')}`;

// Códigos de demostración: en producción los genera la app móvil.
async function semillas(): Promise<Presupuesto[]> {
  const ahora = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      numero: numeroDe(1),
      codigoHash: await hashCodigo('pre-1'),
      estado: 'FINALIZED',
      profesional: profesionalDePrueba(),
      cliente: cliente(),
      descripcion: 'Mantención de calefón',
      levantamiento: { notas: 'Cambiar dos pilas grandes, limpiar chispero y revisar la conexión.', medidas: [] },
      items: [
        { descripcion: 'Pilas grandes', cantidad: 1, unidad: 'un', precioUnitario: 5000 },
        { descripcion: 'Limpiar chispero', cantidad: 1, unidad: 'gl', precioUnitario: 5000 },
        { descripcion: 'Revisión de conexión', cantidad: 1, unidad: 'gl', precioUnitario: 10000 },
      ],
      descuento: 0,
      garantia: '3 meses',
      validezDias: 15,
      observaciones: null,
      creadoEn: ahora,
      finalizadoEn: ahora,
      correoEnviadoEn: null,
    },
    {
      id: randomUUID(),
      numero: null,
      codigoHash: await hashCodigo('pre-2'),
      estado: 'PENDING',
      profesional: profesionalDePrueba(),
      cliente: cliente(),
      descripcion: 'Instalación de enchufes y revisión de tablero',
      levantamiento: {
        notas: 'Casa de dos pisos. Tablero antiguo, sin tierra de protección. El cliente quiere 4 enchufes nuevos en el living.',
        medidas: [
          { etiqueta: 'Largo del pasillo', valor: '6,5 m' },
          { etiqueta: 'Puntos nuevos', valor: '4' },
        ],
      },
      items: [],
      descuento: 0,
      garantia: 'Sin garantía',
      validezDias: 15,
      observaciones: null,
      creadoEn: ahora,
      finalizadoEn: null,
      correoEnviadoEn: null,
    },
  ];
}

async function escribir(lista: Presupuesto[]): Promise<void> {
  await mkdir(path.dirname(ARCHIVO), { recursive: true });
  const temporal = `${ARCHIVO}.tmp`;
  await writeFile(temporal, JSON.stringify(lista, null, 2));
  await rename(temporal, ARCHIVO);
}

async function leer(): Promise<Presupuesto[]> {
  try {
    const guardados = JSON.parse(await readFile(ARCHIVO, 'utf8')) as Presupuesto[];
    // Archivos creados antes de existir el perfil del profesional y la unidad de medida.
    return guardados.map((p) => ({
      ...p,
      profesional: p.profesional ?? profesionalDePrueba(),
      items: p.items.map((i) => ({ ...i, unidad: i.unidad ?? UNIDAD_POR_DEFECTO })),
    }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    const iniciales = await semillas();
    await escribir(iniciales);
    return iniciales;
  }
}

// Verifica contra todos (sin cortar al primero) para que el tiempo no delate si el código existe.
export async function buscarPorCodigo(codigo: string): Promise<Presupuesto | null> {
  let encontrado: Presupuesto | null = null;
  for (const p of await leer()) {
    if ((await verificarCodigo(p.codigoHash, codigo)) && !encontrado) encontrado = p;
  }
  return encontrado;
}

export async function porId(id: string): Promise<Presupuesto | null> {
  return (await leer()).find((p) => p.id === id) ?? null;
}

async function actualizar(id: string, cambio: (p: Presupuesto, lista: Presupuesto[]) => Presupuesto): Promise<Presupuesto> {
  const lista = await leer();
  const actual = lista.find((p) => p.id === id);
  if (!actual) throw new Error('Presupuesto inexistente');
  const nuevo = cambio(actual, lista);
  await escribir(lista.map((p) => (p.id === id ? nuevo : p)));
  return nuevo;
}

// Un presupuesto FINALIZED es inmutable (Contrato de BD): ninguna de estas dos lo modifica.
export async function guardarBorrador(id: string, datos: DatosEditables): Promise<Presupuesto | null> {
  const actual = await porId(id);
  if (!actual || actual.estado !== 'PENDING') return null;
  return actualizar(id, (p) => ({ ...p, ...datos }));
}

export async function finalizar(id: string, datos: DatosEditables): Promise<Finalizado | null> {
  const actual = await porId(id);
  if (!actual || actual.estado !== 'PENDING') return null;
  const nuevo = await actualizar(id, (p, lista) => ({
    ...p,
    ...datos,
    estado: 'FINALIZED',
    numero: numeroDe(lista.filter((x) => x.numero).length + 1),
    finalizadoEn: new Date().toISOString(),
  }));
  return esFinalizado(nuevo) ? nuevo : null;
}

export async function marcarCorreoEnviado(id: string): Promise<void> {
  await actualizar(id, (p) => ({ ...p, correoEnviadoEn: new Date().toISOString() }));
}
