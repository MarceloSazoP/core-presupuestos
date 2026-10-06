"use client";

import MailOutline from "@mui/icons-material/MailOutlined";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";
import { avisar, useAvisar } from "../avisos";
import { enviarCorreoAction, type EstadoCorreo } from "../actions";

// `destino` es el correo del cliente enmascarado; sin correo guardado se pide uno.
export function EnviarCorreo({ destino, etiqueta = "Enviar a correo" }: { destino: string | null; etiqueta?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCorreo, FormData>(enviarCorreoAction, {});
  useAvisar(estado, () => estado.mensaje && (estado.ok ? avisar("exito", "Correo enviado", estado.mensaje) : avisar("error", "No se pudo enviar el correo", estado.mensaje)));

  return (
    <Stack component="form" action={accion} spacing={1}>
      {destino ? null : (
        <TextField
          name="para"
          type="email"
          label="Correo del cliente"
          required
          autoComplete="off"
          placeholder="cliente@correo.cl"
          size="small"
          slotProps={{ htmlInput: { maxLength: 254 } }}
          sx={{ mt: 1 }}
        />
      )}
      <Button type="submit" variant="outlined" startIcon={<MailOutline />} loading={pendiente} loadingPosition="start" sx={{ alignSelf: "flex-start" }}>
        {etiqueta}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {destino ? `Se envía con el PDF adjunto a ${destino}.` : "Se envía con el PDF adjunto."}
      </Typography>
      <Typography role="status" aria-live="polite" variant="body2" color={estado.ok ? "success.main" : "error.main"} sx={{ minHeight: 20 }}>
        {estado.mensaje}
      </Typography>
    </Stack>
  );
}
