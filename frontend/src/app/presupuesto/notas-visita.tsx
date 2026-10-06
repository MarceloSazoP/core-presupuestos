"use client";

import EditOutlined from "@mui/icons-material/EditOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, useTransition } from "react";
import { guardarNotasAction } from "../actions";

// Notas de la visita, editables con el lápiz (Contrato API §6). No lleva <form> propio: se usa dentro del formulario del editor.
export function NotasVisita({ notas }: { notas: string | null }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();

  const guardar = () =>
    empezar(async () => {
      setError(null);
      const r = await guardarNotasAction(texto);
      if (r.error) return setError(r.error);
      setEditando(false);
    });

  if (!editando) {
    return (
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        {notas ? (
          <Typography sx={{ whiteSpace: "pre-line" }}>{notas}</Typography>
        ) : (
          <Typography color="text.secondary">Sin notas.</Typography>
        )}
        <IconButton
          onClick={() => {
            setTexto(notas ?? "");
            setError(null);
            setEditando(true);
          }}
          aria-label="Editar las notas de la visita"
          title="Editar las notas de la visita"
          sx={{ mt: -1, mr: -1 }}
        >
          <EditOutlined />
        </IconButton>
      </Box>
    );
  }
  return (
    <Stack spacing={1.5}>
      <TextField
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        multiline
        minRows={4}
        label="Notas de la visita"
        autoFocus
        slotProps={{ htmlInput: { maxLength: 10000 } }}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" loading={enCurso} onClick={guardar}>
          Guardar
        </Button>
        <Button disabled={enCurso} onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </Stack>
    </Stack>
  );
}
