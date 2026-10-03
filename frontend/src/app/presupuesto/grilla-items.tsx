"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type CellEditingStoppedEvent, type ColDef, type GridApi } from "ag-grid-community";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { clp, miles, milesConDecimal } from "@/lib/formato";
import { GRUPOS_UNIDAD, simboloUnidad, textoUnidad } from "@/lib/opciones";
import { totalLinea } from "@/lib/totales";

ModuleRegistry.registerModules([AllCommunityModule]);

export type Fila = { clave: number; descripcion: string; cantidad: string; unidad: string; precio: string };

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

const EDITABLES = ["descripcion", "cantidad", "unidad", "precio"] as const; // orden de avance con Enter

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
// unidad → precio → descripción de la fila de abajo, creándola si es la última). Escribir sobre una celda la edita.
export function GrillaItems({
  filas,
  onChange,
  onAgregar,
  enfocarAlCargar = false,
}: {
  enfocarAlCargar?: boolean;
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
      { field: "descripcion", headerName: "Descripción", flex: 1, minWidth: 140, cellEditorParams: { maxLength: 300 } },
      {
        field: "cantidad",
        headerName: "Cant.",
        width: 100,
        type: "rightAligned",
        cellEditor: EditorNumero,
        cellEditorParams: { formatear: milesConDecimal, limpiar: limpiarCantidad },
        valueFormatter: (p) => milesConDecimal(p.value ?? ""),
        valueParser: (p) => limpiarCantidad(String(p.newValue ?? "")),
        cellClassRules: { "text-error": (p) => aNumero(p.value ?? "") <= 0 }, // la cantidad debe ser mayor que 0
      },
      {
        field: "unidad",
        headerName: "Unidad",
        width: 120,
        cellEditor: EditorUnidad,
        valueFormatter: (p) => simboloUnidad(p.value ?? ""),
      },
      {
        field: "precio",
        headerName: "Precio unitario",
        width: 170,
        type: "rightAligned",
        cellEditor: EditorNumero,
        cellEditorParams: { formatear: miles, limpiar: limpiarPrecio },
        valueParser: (p) => limpiarPrecio(String(p.newValue ?? "")),
        valueFormatter: (p) => (p.value ? clp(aEntero(p.value)) : "$0"),
      },
      {
        headerName: "Total",
        width: 180, // cabe $999.999.999 en negrita sin cortarse
        type: "rightAligned",
        editable: false,
        cellClass: ["ag-right-aligned-cell", "font-medium"],
        valueGetter: (p) => (p.data ? clp(totalLinea(aNumero(p.data.cantidad), aEntero(p.data.precio))) : ""),
      },
      {
        headerName: "",
        width: 56,
        editable: false,
        cellRenderer: (p: { data?: Fila }) =>
          filas.length > 1 && p.data ? (
            <button
              type="button"
              aria-label="Quitar ítem"
              onClick={() => onChange(filas.filter((f) => f.clave !== p.data?.clave))}
              className="size-full text-muted"
            >
              ×
            </button>
          ) : null,
      },
    ],
    [filas, onChange],
  );

  const alTerminarEdicion = (e: CellEditingStoppedEvent<Fila>) => {
    if (!enterPulsado.current) return; // clic afuera o Escape: no se avanza
    enterPulsado.current = false;
    const sig = EDITABLES.indexOf(e.column.getColId() as (typeof EDITABLES)[number]) + 1;
    const fila = e.rowIndex ?? 0;
    if (sig < EDITABLES.length) return editar(fila, EDITABLES[sig]);
    if (fila < filas.length - 1) return editar(fila + 1, EDITABLES[0]);
    irA.current = { rowIndex: fila + 1, colKey: EDITABLES[0] };
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
        stopEditingWhenCellsLoseFocus
        onGridReady={(e) => (api.current = e.api)}
        onFirstDataRendered={() => enfocarAlCargar && editar(0, EDITABLES[0])}
        onCellValueChanged={(e) => onChange(filas.map((f) => (f.clave === e.data?.clave ? { ...e.data } : f)))}
        onCellEditingStopped={alTerminarEdicion}
      />
      {/* La grilla no son <input>: el formulario recibe los ítems por estos campos ocultos. */}
      {filas.map((f) => (
        <span key={f.clave} hidden>
          <input type="hidden" name="item_descripcion" value={f.descripcion} readOnly />
          <input type="hidden" name="item_cantidad" value={f.cantidad} readOnly />
          <input type="hidden" name="item_unidad" value={f.unidad} readOnly />
          <input type="hidden" name="item_precio" value={f.precio} readOnly />
        </span>
      ))}
    </div>
  );
}
