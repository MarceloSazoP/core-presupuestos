import LockOutlined from "@mui/icons-material/LockOutlined";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import type { ReactNode } from "react";

// Lo que el profesional anotó en terreno: notas, medidas, fotos y voz. Es interno (no sale en el PDF ni en la vista del
// cliente): el encabezado de aviso lo separa de la hoja que sí recibe el cliente.
export function DeLaVisita({ children }: { children: ReactNode }) {
  return (
    <Card component="section" aria-labelledby="de-la-visita" sx={{ minWidth: 0 }}>
      <Alert severity="warning" icon={<LockOutlined />} sx={{ borderRadius: 0 }}>
        <AlertTitle id="de-la-visita" component="h2" sx={{ mb: 0 }}>
          De la visita
        </AlertTitle>
        Solo para ti · no sale en el PDF
      </Alert>
      <Stack spacing={2.5} sx={{ p: 2 }}>
        {children}
      </Stack>
    </Card>
  );
}

// Medidas tomadas en la visita, cada una como un dato suelto («Largo del pasillo: 6,5 m»).
export function Medidas({ medidas }: { medidas: { etiqueta: string; valor: string }[] }) {
  if (medidas.length === 0) return null;
  return (
    <Stack component="ul" aria-label="Medidas" direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1, m: 0, p: 0, listStyle: "none" }}>
      {medidas.map((m) => (
        <li key={`${m.etiqueta}:${m.valor}`}>
          <Chip
            variant="outlined"
            label={
              <>
                {m.etiqueta}: <b style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{m.valor}</b>
              </>
            }
          />
        </li>
      ))}
    </Stack>
  );
}
