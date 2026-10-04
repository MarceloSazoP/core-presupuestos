"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type CellEditingStoppedEvent, type ColDef, type GridApi } from "ag-grid-community";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { clp, miles, milesConDecimal } from "@/lib/formato";
import { GRUPOS_UNIDAD, simboloUnidad, textoUnidad } from "@/lib/opciones";
import { totalLinea } from "@/lib/totales";

ModuleRegistry.registerModules([AllCommunityModule]);

// `tipo`: un ítem se calcula como cantidad × precio; una tarea («botar escombros») no tiene cantidad ni unidad y su precio
// es opcional (vacío = incluida).
export type Fila = { clave: number; tipo: "item" | "tarea"; descripcion: string; cantidad: string; unidad: string; precio: string };

// Mismo parseo que el editor: solo vista previa, el servidor vuelve a validar.
const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

// Colores y medidas enlazados a los tokens de la app, para que siga el tema claro/oscuro.
const tema = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 16,
  rowHeight: 44,
  headerHeight: 40,
  backgroundColor: "var(--card)",
  foregroundColor: "var(--foreground)",
  headerBackgroundColor: "color-mix(in oklab, var(--foreground) 5%, var(--card))",
  headerTextColor: "var(--muted)",
  borderColor: "var(--borde)",
  accentColor: "var(--acento-texto)",
  wrapperBorderRadius: 12,
});

// Mismos límites que valida el servidor (Zod en actions.ts): aquí solo evitan escribir basura.
const MAX_CANTIDAD = 1_000_000;
const MAX_PRECIO = 999_999_999;
// Cantidad: dígitos con una coma decimal (los puntos son solo de miles y se ignoran), hasta 3 decimales. Precio: solo dígitos.
const limpiarCantidad = (v: string) => {
  const [entera = "", ...dec] = v.replace(/[^\d,]/g, "").split(",");
  const n = dec.length ? `${entera || "0"},${dec.join("").slice(0, 3)}` : entera;
  return aNumero(n) > MAX_CANTIDAD ? String(MAX_CANTIDAD) : n;
};
const limpiarPrecio = (v: string) => String(Math.min(aEntero(v), MAX_PRECIO) || "");
const CARACTERES_VALIDOS: Record<string, RegExp> = { cantidad: /^[\d,]*$/, precio: /^\d*$/ };

const EDITABLES: readonly string[] = ["descripcion", "cantidad", "unidad", "precio"]; // orden de avance con Enter
const EDITABLES_TAREA: readonly string[] = ["descripcion", "precio"];

// Editor numérico: muestra el valor con puntos de miles mientras se escribe y guarda solo el valor limpio.
// Mantiene su propio estado: así el campo responde al teclear sin depender del ciclo de props de la grilla.
function EditorNumero({
  initialValue,
  onValueChange,
  eventKey,
  formatear,
  limpiar,
}: CustomCellEditorProps<Fila, string> & { formatear: (crudo: string) => string; limpiar: (escrito: string) => string }) {
  // Si la edición empezó tecleando sobre la celda, ese carácter reemplaza el contenido.
  const tecleado = eventKey && eventKey.length === 1 ? limpiar(eventKey) : null;
  const [valor, setValor] = useState(tecleado ?? initialValue ?? "");
  useEffect(() => {
    if (tecleado !== null) onValueChange(tecleado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <input
      autoFocus
      inputMode="decimal"
      autoComplete="off"
      value={formatear(valor)}
      onChange={(e) => {
        const limpio = limpiar(e.target.value);
        setValor(limpio);
        onValueChange(limpio);
      }}
      onFocus={(e) => (tecleado === null ? e.target.select() : undefined)}
      className="size-full bg-card px-3 text-right text-foreground outline-none"
    />
  );
}

// Editor de unidad con <select> nativo: Enter lo cierra al instante (el selector propio de AG Grid pide dos Enter).
function EditorUnidad({ initialValue, onValueChange }: CustomCellEditorProps<Fila, string>) {
  const [valor, setValor] = useState(initialValue ?? "");
  return (
    <select
      autoFocus
      aria-label="Unidad"
      value={valor}
      onChange={(e) => {
        setValor(e.target.value);
        onValueChange(e.target.value);
      }}
      className="size-full bg-card px-2 text-foreground"
    >
      {GRUPOS_UNIDAD.map((g) => (
        <optgroup key={g.grupo} label={g.grupo}>
          {g.unidades.map((u) => (
            <option key={u.codigo} value={u.codigo}>
              {textoUnidad(u)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// Grilla editable de ítems (AG Grid Community). Enter confirma la celda y abre la siguiente (descripción → cantidad →
// unidad → precio → descripción de la fila de abajo, creándola si es la última). Un clic sobre una celda la edita.
export function GrillaItems({
  filas,
  onChange,
  onAgregar,
}: {
  filas: Fila[];
  onChange: (filas: Fila[]) => void;
  onAgregar: () => void;
}) {
  const api = useRef<GridApi<Fila> | null>(null);
  const enterPulsado = useRef(false);
  const irA = useRef<{ rowIndex: number; colKey: string } | null>(null);

  const editar = (rowIndex: number, colKey: string) => {
    api.current?.setFocusedCell(rowIndex, colKey);
    api.current?.startEditingCell({ rowIndex, colKey });
  };

  // Tras agregar una fila hay que esperar al render para abrir su editor.
  useEffect(() => {
    if (!irA.current) return;
    const { rowIndex, colKey } = irA.current;
    irA.current = null;
    setTimeout(() => editar(rowIndex, colKey), 50); // espera a que AG Grid pinte la fila nueva
  }, [filas.length]);

  const columnas = useMemo<ColDef<Fila>[]>(
    () => [
      {
        field: "descripcion",
        headerName: "Descripción",
        flex: 1,
        minWidth: 140,
        cellEditorParams: { maxLength: 300 },
        // La etiqueta distingue las tareas de los ítems de un vistazo.
        cellRenderer: (p: { data?: Fila; value?: string }) =>
          p.data?.tipo === "tarea" ? (
            <span className="flex items-center gap-2">
              <span className="shrink-0 rounded border border-borde px-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Tarea</span>
              <span className="truncate">{p.value}</span>
            </span>
          ) : (
            p.value
          ),
      },
      {
        field: "cantidad",
        headerName: "Cant.",
        width: 100,
        type: "rightAligned",
        editable: (p) => p.data?.tipo !== "tarea", // una tarea no lleva cantidad
        cellEditor: EditorNumero,
        cellEditorParams: { formatear: milesConDecimal, limpiar: limpiarCantidad },
        valueFormatter: (p) => (p.data?.tipo === "tarea" ? "—" : milesConDecimal(p.value ?? "")),
        valueParser: (p) => limpiarCantidad(String(p.newValue ?? "")),
        cellClassRules: { "text-error": (p) => p.data?.tipo !== "tarea" && aNumero(p.value ?? "") <= 0 }, // la cantidad de un ítem debe ser mayor que 0
      },
      {
        field: "unidad",
        headerName: "Unidad",
        width: 120,
        editable: (p) => p.data?.tipo !== "tarea", // ni unidad
        cellEditor: EditorUnidad,
        valueFormatter: (p) => (p.data?.tipo === "tarea" ? "—" : simboloUnidad(p.value ?? "")),
      },
      {
        field: "precio",
        headerName: "Precio unitario",
        width: 170,
        type: "rightAligned",
        cellEditor: EditorNumero,
        cellEditorParams: { formatear: miles, limpiar: limpiarPrecio },
        valueParser: (p) => limpiarPrecio(String(p.newValue ?? "")),
        // En una tarea el precio es opcional: vacío significa que va incluida en el presupuesto.
        valueFormatter: (p) => (p.value ? clp(aEntero(p.value)) : p.data?.tipo === "tarea" ? "Incluido" : "$0"),
      },
      {
        headerName: "Total",
        width: 180, // cabe $999.999.999 en negrita sin cortarse
        type: "rightAligned",
        editable: false,
        cellClass: ["ag-right-aligned-cell", "font-medium"],
        valueGetter: (p) => {
          if (!p.data) return "";
          if (p.data.tipo === "tarea") return aEntero(p.data.precio) > 0 ? clp(aEntero(p.data.precio)) : "Incluido";
          return clp(totalLinea(aNumero(p.data.cantidad), aEntero(p.data.precio)));
        },
      },
      {
        headerName: "",
        width: 56,
        editable: false,
        cellRenderer: (p: { data?: Fila }) =>
          filas.length > 1 && p.data ? (
            <button
              type="button"
              aria-label="Quitar línea"
              onClick={() => onChange(filas.filter((f) => f.clave !== p.data?.clave))}
              title="Quitar línea"
              className="boton-icono size-full !min-h-0 hover:!text-error"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          ) : null,
      },
    ],
    [filas, onChange],
  );

  const alTerminarEdicion = (e: CellEditingStoppedEvent<Fila>) => {
    if (!enterPulsado.current) return; // clic afuera o Escape: no se avanza
    enterPulsado.current = false;
    const fila = e.rowIndex ?? 0;
    const orden = filas[fila]?.tipo === "tarea" ? EDITABLES_TAREA : EDITABLES; // una tarea salta cantidad y unidad
    const sig = orden.indexOf(e.column.getColId()) + 1;
    if (sig < orden.length) return editar(fila, orden[sig]!);
    if (fila < filas.length - 1) return editar(fila + 1, EDITABLES[0]);
    irA.current = { rowIndex: fila + 1, colKey: EDITABLES[0]! };
    onAgregar();
  };

  // Enter no debe enviar el formulario: al abrir/cerrar un editor el foco cae en un <input> antes del keypress y el
  // navegador haría un envío implícito. El keypress se cancela aquí (no el keydown: AG Grid ignora los cancelados) y se
  // anota si había una celda en edición, para avanzar a la siguiente al cerrarla.
  const anotarEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (api.current?.getEditingCells().length ?? 0) > 0) enterPulsado.current = true;
  };
  // Bloquea la tecla que no corresponde a la columna (letras en cantidad/precio); lo pegado pasa y el editor lo limpia.
  const filtrarTecleo = (e: FormEvent<HTMLDivElement>) => {
    const columna = (e.target as HTMLElement).closest(".ag-cell")?.getAttribute("col-id");
    const permitido = columna ? CARACTERES_VALIDOS[columna] : undefined;
    const dato = (e.nativeEvent as InputEvent).data;
    if (permitido && dato?.length === 1 && !permitido.test(dato)) e.preventDefault(); // pegar o autocompletar se limpia al escribir en el editor
  };
  const evitarEnvio = (e: KeyboardEvent<HTMLDivElement>) => e.key === "Enter" && e.preventDefault();

  return (
    <div onKeyDownCapture={anotarEnter} onKeyPressCapture={evitarEnvio} onBeforeInputCapture={filtrarTecleo}>
      <AgGridReact<Fila>
        theme={tema}
        rowData={filas}
        columnDefs={columnas}
        defaultColDef={{
          editable: true,
          sortable: false,
          suppressMovable: true,
        }}
        getRowId={(p) => String(p.data.clave)}
        domLayout="autoHeight"
        enterNavigatesVerticallyAfterEdit={false}
        singleClickEdit // un clic abre el editor de la celda (por defecto AG Grid pide doble clic o empezar a escribir)
        stopEditingWhenCellsLoseFocus
        onGridReady={(e) => (api.current = e.api)}
        onCellValueChanged={(e) => onChange(filas.map((f) => (f.clave === e.data?.clave ? { ...e.data } : f)))}
        onCellEditingStopped={alTerminarEdicion}
      />
      {/* La grilla no son <input>: el formulario recibe los ítems por estos campos ocultos. */}
      {filas.map((f) => (
        <span key={f.clave} hidden>
          <input type="hidden" name="item_tipo" value={f.tipo} readOnly />
          <input type="hidden" name="item_descripcion" value={f.descripcion} readOnly />
          <input type="hidden" name="item_cantidad" value={f.cantidad} readOnly />
          <input type="hidden" name="item_unidad" value={f.unidad} readOnly />
          <input type="hidden" name="item_precio" value={f.precio} readOnly />
        </span>
      ))}
    </div>
  );
}
