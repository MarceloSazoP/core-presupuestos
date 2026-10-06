"use client";

import Close from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSyncExternalStore } from "react";
import { dinero, milesConDecimal } from "@/lib/formato";
import { GRUPOS_UNIDAD, textoUnidad } from "@/lib/opciones";
import { totalLinea } from "@/lib/totales";
import { limpiarCantidad, limpiarPrecio, type Fila } from "./grilla-items";

const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

const ANGOSTO = "(max-width: 819px)"; // la grilla necesita ~710 px de ancho útil
// Teléfono y tablet vertical: la grilla no cabe (esconde el precio y el total), así que los ítems se editan como tarjetas. En el servidor se asume ancho.
export function useEsAngosto() {
  return useSyncExternalStore(
    (avisar) => {
      const m = matchMedia(ANGOSTO);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => matchMedia(ANGOSTO).matches,
    () => false,
  );
}

// Mismos datos y mismas reglas que la grilla (`Fila`): solo cambia cómo se presentan.
export function ListaItemsMovil({ moneda, filas, onChange }: { moneda: string; filas: Fila[]; onChange: (filas: Fila[]) => void }) {
  const clp = (n: number) => dinero(n, moneda);
  const cambiar = (clave: number, campos: Partial<Fila>) => onChange(filas.map((f) => (f.clave === clave ? { ...f, ...campos } : f)));
  return (
    <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {filas.map((f, n) => {
        const tarea = f.tipo === "tarea";
        const total = tarea ? (aEntero(f.precio) > 0 ? clp(aEntero(f.precio)) : "Incluido") : clp(totalLinea(aNumero(f.cantidad), aEntero(f.precio)));
        return (
          <Paper component="li" key={f.clave} variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Typography variant="subtitle1" component="p" sx={{ fontWeight: 500 }}>
                {tarea ? "Tarea" : "Ítem"} {n + 1}
              </Typography>
              {filas.length > 1 ? (
                <IconButton onClick={() => onChange(filas.filter((x) => x.clave !== f.clave))} aria-label={`Quitar la línea ${n + 1}`} sx={{ mr: -1, "&:hover": { color: "error.main" } }}>
                  <Close />
                </IconButton>
              ) : null}
            </Box>

            <TextField
              label={tarea ? "Qué se hace" : "Descripción"}
              autoComplete="off"
              value={f.descripcion}
              onChange={(e) => cambiar(f.clave, { descripcion: e.target.value })}
              placeholder={tarea ? "Por ejemplo: botar escombros" : "Qué vas a hacer o vender"}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />

            {tarea ? (
              <TextField
                label="Valor (opcional)"
                autoComplete="off"
                value={f.precio ? clp(aEntero(f.precio)) : ""}
                onChange={(e) => cambiar(f.clave, { precio: limpiarPrecio(e.target.value) })}
                placeholder="$0"
                helperText="Si lo dejas vacío, la tarea va incluida en el presupuesto."
                slotProps={{ htmlInput: { inputMode: "numeric", style: { textAlign: "right" } } }}
              />
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: "6rem minmax(0, 1fr)", gap: 2 }}>
                <TextField
                  label="Cantidad"
                  autoComplete="off"
                  value={milesConDecimal(f.cantidad)}
                  onChange={(e) => cambiar(f.clave, { cantidad: limpiarCantidad(e.target.value) })}
                  error={aNumero(f.cantidad) <= 0}
                  slotProps={{ htmlInput: { inputMode: "decimal", style: { textAlign: "right" } } }}
                />
                <TextField select label="Unidad" value={f.unidad} onChange={(e) => cambiar(f.clave, { unidad: e.target.value })} slotProps={{ select: { native: true } }}>
                  {GRUPOS_UNIDAD.map((g) => (
                    <optgroup key={g.grupo} label={g.grupo}>
                      {g.unidades.map((u) => (
                        <option key={u.codigo} value={u.codigo}>
                          {textoUnidad(u)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </TextField>
                <TextField
                  label="Precio unitario"
                  autoComplete="off"
                  value={f.precio ? clp(aEntero(f.precio)) : ""}
                  onChange={(e) => cambiar(f.clave, { precio: limpiarPrecio(e.target.value) })}
                  placeholder="$0"
                  slotProps={{ htmlInput: { inputMode: "numeric", style: { textAlign: "right" } } }}
                  sx={{ gridColumn: "1 / -1" }}
                />
              </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: 1, borderColor: "divider", pt: 1.5, fontVariantNumeric: "tabular-nums" }}>
              <Typography variant="body2" color="text.secondary">
                Total de la línea
              </Typography>
              <Typography variant="h6" component="p">
                {total}
              </Typography>
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
}
