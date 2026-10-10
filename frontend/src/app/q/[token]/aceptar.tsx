"use client";

import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState, useTransition } from "react";
import { aceptarAction, type EstadoAceptar } from "./acciones";

type Props = {
  token: string;
  total: string;
  profesional: string;
  aceptado: boolean;
  puede: boolean; // la API dice si todavía se puede aceptar (no vencido, rechazado ni reemplazado)
  desdeCorreo: boolean; // llegó desde el botón «Aceptar el presupuesto» del correo (?aceptar=1): ese botón ES la aceptación
};

// Aceptar el presupuesto (Contrato API §10). El botón del correo acepta: la página, al abrirse con ?aceptar=1, hace el POST sola.
// Lo hace el navegador (este efecto), nunca el GET de la página: un filtro de correo que abre el enlace no ejecuta el script y no
// acepta nada. Desde la página, el botón acepta directo. Desde el correo va arriba de la página (page.tsx), para que se vea el aviso
// mientras acepta o un error; aceptado, la confirmación va arriba y esto no muestra nada.
export function Aceptar({ token, total, profesional, aceptado, puede, desdeCorreo }: Props) {
  const [estado, setEstado] = useState<EstadoAceptar>({});
  const [enCurso, empezar] = useTransition();
  const yaPedido = useRef(false); // en desarrollo React corre el efecto dos veces; la API igual no repite nada
  const listo = aceptado || !!estado.listo;
  const solo = desdeCorreo && puede && !estado.error; // aceptando por el botón del correo: sin botón, solo el aviso

  const aceptar = () =>
    empezar(async () => {
      const r = await aceptarAction(token);
      setEstado(r);
      if (r.listo) window.scrollTo({ top: 0 }); // la confirmación queda arriba
    });

  useEffect(() => {
    if (!desdeCorreo || !puede || aceptado || yaPedido.current) return;
    yaPedido.current = true;
    aceptar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, al abrir desde el correo
  }, []);

  if (listo) return null;
  return (
    <>
      <Paper component="section" aria-label="Aceptar el presupuesto" sx={{ p: { xs: 2.5, sm: 4 }, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
        {!puede ? (
          <Alert severity="info" sx={{ alignSelf: "stretch" }}>
            Este presupuesto ya no se puede aceptar en línea. Habla con {profesional} para revisarlo.
          </Alert>
        ) : enCurso || solo ? (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={24} />
            <Typography>Aceptando el presupuesto…</Typography>
          </Box>
        ) : (
          <>
            {estado.error ? (
              <Alert severity="error" sx={{ alignSelf: "stretch" }}>
                {estado.error}
              </Alert>
            ) : null}
            <Button variant="contained" size="large" startIcon={<CheckCircleOutline />} onClick={aceptar}>
              Aceptar el presupuesto
            </Button>
          </>
        )}
      </Paper>

      {/* En el teléfono, una barra fija abajo con el total y el botón a mano. */}
      {puede && !desdeCorreo ? (
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
          <Button variant="contained" startIcon={<CheckCircleOutline />} onClick={aceptar} loading={enCurso} loadingPosition="start">
            Aceptar
          </Button>
        </Paper>
      ) : null}
    </>
  );
}
