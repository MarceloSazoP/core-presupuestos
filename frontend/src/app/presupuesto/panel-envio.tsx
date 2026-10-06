"use client";

import CheckCircle from "@mui/icons-material/CheckCircle";
import ContentCopy from "@mui/icons-material/ContentCopy";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { avisar } from "../avisos";
import { marcarEnviadoAction } from "../actions";
import { EnlaceWhatsApp } from "./enlace-whatsapp";
import { EnviarCorreo } from "./enviar-correo";

type Props = {
  nombre: string;
  whatsappUrl: string;
  enlace: string | null;
  correo: string | null;
  resultadoCorreo?: { ok: boolean; mensaje: string }; // el envío automático al terminar; no viene al abrir un presupuesto ya cerrado
};

// Cómo le llega el presupuesto cerrado al cliente: correo, WhatsApp, enlace de solo lectura y PDF.
export function PanelEnvio({ nombre, whatsappUrl, enlace, correo, resultadoCorreo }: Props) {
  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      avisar("exito", "Enlace copiado", "Pégalo donde quieras compartirlo.");
      void marcarEnviadoAction("LINK");
    } catch {
      avisar("error", "No se pudo copiar el enlace", "Selecciónalo y cópialo a mano.");
    }
  };

  return (
    <Card component="section" aria-labelledby="titulo-envio">
      <CardHeader title={`Cómo le llega a ${nombre}`} slotProps={{ title: { id: "titulo-envio", component: "h2", variant: "h6" } }} />
      <Stack divider={<Divider />}>
        <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
          <Typography variant="overline" component="h3" color="text.secondary">
            Correo
          </Typography>
          {resultadoCorreo?.ok ? (
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }} role="status">
              <CheckCircle color="success" />
              <Typography>{resultadoCorreo.mensaje}</Typography>
            </Box>
          ) : null}
          {/* Sin correo del cliente no es un error: se cerró sin enviarlo y aquí se puede indicar uno. */}
          {resultadoCorreo && !resultadoCorreo.ok ? (
            correo ? (
              <Alert severity="error" role="alert">
                El correo no se pudo enviar: {resultadoCorreo.mensaje} El presupuesto ya está cerrado; reintenta o mándalo por WhatsApp.
              </Alert>
            ) : (
              <Alert severity="info">{resultadoCorreo.mensaje}</Alert>
            )
          ) : null}
          <EnviarCorreo destino={correo} etiqueta={resultadoCorreo?.ok ? "Reenviar correo" : resultadoCorreo && correo ? "Reintentar el envío" : "Enviar a correo"} />
        </Stack>

        <Stack spacing={1} sx={{ p: 2 }}>
          <Typography variant="overline" component="h3" color="text.secondary">
            WhatsApp
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Se abre con el mensaje y el enlace listos.
          </Typography>
          <EnlaceWhatsApp href={whatsappUrl} />
        </Stack>

        {enlace ? (
          <Stack spacing={1} sx={{ p: 2 }}>
            <TextField
              label="Enlace del presupuesto"
              value={enlace}
              helperText="Solo lectura: tu cliente no puede editarlo."
              onFocus={(e) => e.target.select()}
              slotProps={{
                htmlInput: { readOnly: true },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={copiar} aria-label="Copiar el enlace" edge="end">
                        <ContentCopy />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        ) : null}

        <Box sx={{ p: 2 }}>
          <Button href="/presupuesto/pdf" download variant="outlined" startIcon={<FileDownloadOutlined />} fullWidth>
            Descargar PDF
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}
