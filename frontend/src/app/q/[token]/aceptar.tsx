"use client";

import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import WhatsApp from "@mui/icons-material/WhatsApp";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState, useTransition } from "react";
import { aceptarAction, type EstadoAceptar } from "./acciones";

type Props = {
  token: string;
  numero: string;
  total: string;
  profesional: { name: string; phone: string };
  aceptadoEl: string | null; // la fecha legible, si ya está aceptado
  puede: boolean; // la API dice si todavía se puede aceptar (no vencido, rechazado ni reemplazado)
  abrir: boolean; // llegó desde el botón «Aceptar el presupuesto» del correo (?aceptar=1): la confirmación ya abierta
};

// Lo que el cliente puede hacer con su presupuesto (Contrato API §10): aceptarlo, confirmando en un segundo paso (un filtro de correo
// que abre el enlace no acepta nada), o hablar con el profesional. No hay botón de rechazar. Incluye la barra fija del teléfono, que
// comparte el estado: «Aceptar» ahí abre la misma confirmación.
export function Aceptar({ token, numero, total, profesional, aceptadoEl, puede, abrir }: Props) {
  const [confirmando, setConfirmando] = useState(abrir && puede);
  const [estado, setEstado] = useState<EstadoAceptar>({});
  const [enCurso, empezar] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const tel = profesional.phone.replace(/\D/g, "");

  useEffect(() => {
    if (abrir && puede) panel.current?.scrollIntoView({ block: "center" });
  }, [abrir, puede]);

  const abrirConfirmacion = () => {
    setConfirmando(true);
    panel.current?.scrollIntoView({ block: "center" });
  };
  const aceptar = () => empezar(async () => setEstado(await aceptarAction(token)));
  const sePuede = puede && !estado.listo && !aceptadoEl;

  return (
    <>
      <Paper id="aceptar" ref={panel} component="section" aria-label="Aceptar el presupuesto" sx={{ p: { xs: 2.5, sm: 4 }, display: "flex", flexDirection: "column", gap: 2.5, scrollMarginTop: 16 }}>
        {estado.listo ? (
          <Alert severity="success" role="status">
            ¡Listo! Aceptaste el presupuesto {numero}. {estado.correo ? "Te enviamos el PDF con el timbre «Aceptado» a tu correo. " : ""}
            {profesional.name} se pondrá en contacto contigo para coordinar el trabajo.
          </Alert>
        ) : aceptadoEl ? (
          <Alert severity="success">
            Aceptaste este presupuesto el {aceptadoEl}. {profesional.name} se pondrá en contacto contigo para coordinar el trabajo.
          </Alert>
        ) : !puede ? (
          <Alert severity="info">Este presupuesto ya no se puede aceptar en línea. Habla con {profesional.name} para revisarlo.</Alert>
        ) : confirmando ? (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              ¿Aceptas el presupuesto {numero} por {total}?
            </Typography>
            <Typography color="text.secondary">
              {profesional.name} recibe el aviso al instante y te enviamos el PDF con el timbre «Aceptado» al correo con el que te llegó.
            </Typography>
            {estado.error ? <Alert severity="error">{estado.error}</Alert> : null}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              <Button variant="contained" size="large" startIcon={<CheckCircleOutline />} onClick={aceptar} loading={enCurso} loadingPosition="start" autoFocus>
                Sí, acepto el presupuesto
              </Button>
              <Button size="large" onClick={() => setConfirmando(false)} disabled={enCurso}>
                Volver
              </Button>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <Typography variant="h6" component="h2">
              ¿Te parece bien?
            </Typography>
            <Button variant="contained" size="large" startIcon={<CheckCircleOutline />} onClick={abrirConfirmacion}>
              Aceptar el presupuesto
            </Button>
          </Stack>
        )}

        <Stack spacing={1.5} sx={{ pt: 2.5, borderTop: 1, borderColor: "divider" }}>
          <Typography color="text.secondary">¿Tienes dudas o quieres cambiar algo? Habla con {profesional.name}:</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Button href={`tel:${profesional.phone}`} variant="outlined" size="large" startIcon={<PhoneOutlined />}>
              Llamar por teléfono
            </Button>
            <Button href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" variant="outlined" size="large" startIcon={<WhatsApp />}>
              Escribir por WhatsApp
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* En el teléfono, una barra fija abajo con el total y la acción a mano. */}
      <Paper
        square
        elevation={8}
        sx={{
          display: { xs: "flex", sm: "none" },
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          mx: -2,
          mb: -2,
          px: 2,
          pt: 1.5,
          pb: "max(12px, env(safe-area-inset-bottom, 0px))", // el indicador de inicio del iPhone no tapa el botón
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {total}
          </Typography>
        </Box>
        {sePuede ? (
          <Button variant="contained" startIcon={<CheckCircleOutline />} onClick={abrirConfirmacion}>
            Aceptar
          </Button>
        ) : (
          <Button href={`tel:${profesional.phone}`} variant="outlined" startIcon={<PhoneOutlined />}>
            Llamar
          </Button>
        )}
      </Paper>
    </>
  );
}
