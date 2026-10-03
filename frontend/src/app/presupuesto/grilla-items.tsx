"use client";

import "react-data-grid/lib/styles.css";
import { useEffect, useMemo, useRef } from "react";
import { DataGrid, renderTextEditor, type CellKeyboardEvent, type CellKeyDownArgs, type Column, type DataGridHandle } from "react-data-grid";
import { clp } from "@/lib/formato";
import { GRUPOS_UNIDAD, simboloUnidad, textoUnidad } from "@/lib/opciones";
import { totalLinea } from "@/lib/totales";

export type Fila = { clave: number; descripcion: string; cantidad: string; unidad: string; precio: string };

// Mismo parseo que el editor: solo vista previa, el servidor vuelve a validar.
const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

const ALTO_FILA = 44;
const ALTO_CABECERA = 40;
const COL_PRECIO = 3; // última columna editable: Enter ahí pasa a la fila siguiente

// Grilla editable de ítems. Enter confirma la celda y abre la siguiente (descripción → cantidad → unidad → precio →
// descripción de la fila de abajo, creándola si es la última). Tab/flechas mueven sin editar; escribir sobre una celda edita.
export function GrillaItems({
  filas,
  onChange,
  onAgregar,
}: {
  filas: Fila[];
  onChange: (filas: Fila[]) => void;
  onAgregar: () => void;
}) {
  const grilla = useRef<DataGridHandle>(null);
  const irA = useRef<{ idx: number; rowIdx: number } | null>(null);

  // Tras agregar una fila hay que esperar al render para poder abrir su editor.
  useEffect(() => {
    if (!irA.current) return;
    grilla.current?.setActivePosition(irA.current, { enableEditor: true });
    irA.current = null;
  }, [filas.length]);

  const columnas = useMemo<Column<Fila>[]>(
    () => [
      { key: "descripcion", name: "Descripción", minWidth: 140, editable: true, renderEditCell: renderTextEditor },
      { key: "cantidad", name: "Cant.", width: 70, editable: true, cellClass: "text-right", headerCellClass: "text-right", renderEditCell: renderTextEditor },
      {
        key: "unidad",
        name: "Unidad",
        width: 110,
        editable: true,
        renderCell: ({ row }) => simboloUnidad(row.unidad),
        renderEditCell: ({ row, onRowChange }) => (
          <select
            autoFocus
            aria-label="Unidad"
            value={row.unidad}
            onChange={(e) => onRowChange({ ...row, unidad: e.target.value }, true)}
            className="size-full bg-background px-2 text-foreground"
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
        ),
      },
      {
        key: "precio",
        name: "Precio unitario",
        width: 120,
        editable: true,
        cellClass: "text-right",
        headerCellClass: "text-right",
        renderCell: ({ row }) => (row.precio ? clp(aEntero(row.precio)) : <span className="text-muted">$0</span>),
        renderEditCell: renderTextEditor,
      },
      {
        key: "total",
        name: "Total",
        width: 110,
        cellClass: "text-right font-medium",
        headerCellClass: "text-right",
        renderCell: ({ row }) => clp(totalLinea(aNumero(row.cantidad), aEntero(row.precio))),
      },
      {
        key: "quitar",
        name: "",
        width: 48,
        renderCell: ({ row, tabIndex }) =>
          filas.length > 1 && (
            <button
              type="button"
              tabIndex={tabIndex}
              aria-label="Quitar ítem"
              onClick={() => onChange(filas.filter((f) => f.clave !== row.clave))}
              className="size-full text-muted"
            >
              ×
            </button>
          ),
      },
    ],
    [filas, onChange],
  );

  const alPulsarTecla = (args: CellKeyDownArgs<Fila>, e: CellKeyboardEvent) => {
    if (e.key !== "Enter") return;
    // Enter nunca debe enviar el formulario: al abrir o cerrar un editor el foco cae en un <input> antes del keypress y
    // el navegador haría un envío implícito (RDG además corta la propagación, así que el form no alcanza a evitarlo).
    e.preventDefault();
    if (args.mode !== "EDIT") return;
    const { column, rowIdx, onClose } = args;
    e.preventGridDefault();
    onClose(true, false);
    const idx = column.idx;
    if (idx < COL_PRECIO) return void grilla.current?.setActivePosition({ idx: idx + 1, rowIdx }, { enableEditor: true });
    if (rowIdx < filas.length - 1) return void grilla.current?.setActivePosition({ idx: 0, rowIdx: rowIdx + 1 }, { enableEditor: true });
    irA.current = { idx: 0, rowIdx: rowIdx + 1 };
    onAgregar();
  };

  return (
    <>
      <DataGrid
        ref={grilla}
        aria-label="Ítems del presupuesto"
        columns={columnas}
        rows={filas}
        rowKeyGetter={(f) => f.clave}
        onRowsChange={onChange}
        onCellKeyDown={alPulsarTecla}
        rowHeight={ALTO_FILA}
        headerRowHeight={ALTO_CABECERA}
        enableVirtualization={false}
        className="grilla-items"
        style={{ blockSize: ALTO_CABECERA + filas.length * ALTO_FILA + 20 }}
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
    </>
  );
}
