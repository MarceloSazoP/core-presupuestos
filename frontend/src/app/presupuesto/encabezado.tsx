"use client";

import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { salirAction } from "../actions";
import { Reloj } from "../reloj";

type Profesional = { nombre: string; telefono: string; correo: string };

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

// Alterna claro/oscuro. Los dos íconos están en el HTML y el CSS muestra el que corresponde: así no hay diferencia entre el
// servidor (que no conoce el modo) y el navegador.
function BotonTema() {
  const { mode, systemMode, setMode } = useColorScheme();
  const alternar = () => setMode((mode === "system" ? systemMode : mode) === "dark" ? "light" : "dark");
  return (
    <IconButton color="inherit" onClick={alternar} aria-label="Cambiar entre tema claro y oscuro" title="Cambiar tema">
      <LightModeOutlined sx={(t) => ({ display: "none", ...t.applyStyles("dark", { display: "inline-block" }) })} />
      <DarkModeOutlined sx={(t) => ({ display: "inline-block", ...t.applyStyles("dark", { display: "none" }) })} />
    </IconButton>
  );
}

// Dueño del presupuesto (usuario de la app móvil): logo, nombre y contacto, con la fecha y hora en vivo.
export function Encabezado({ profesional, logoSrc }: { profesional: Profesional; logoSrc: string | null }) {
  const telefono = profesional.telefono.replace(/[^\d+]/g, "");
  return (
    <AppBar position="static">
      <Toolbar sx={{ mx: "auto", width: "100%", maxWidth: "84rem", flexWrap: "wrap", gap: 2, py: 1, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: "1 1 auto" }}>
          {logoSrc ? (
            // Archivo privado servido por el BFF: el logo va sobre blanco para que se vea igual en cualquier tema.
            <Avatar src={logoSrc} alt={`Logo de ${profesional.nombre}`} variant="rounded" sx={{ width: 48, height: 48, bgcolor: "common.white", "& img": { objectFit: "contain", p: 0.5 } }} />
          ) : (
            <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }}>{iniciales(profesional.nombre)}</Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography component="p" variant="h6" noWrap>
              {profesional.nombre}
            </Typography>
            <Typography component="p" variant="body2" sx={{ display: "flex", flexWrap: "wrap", columnGap: 2, opacity: 0.9 }}>
              <Link href={`tel:${telefono}`} color="inherit" underline="hover">
                {profesional.telefono}
              </Link>
              <Link href={`mailto:${profesional.correo}`} color="inherit" underline="hover" sx={{ wordBreak: "break-all" }}>
                {profesional.correo}
              </Link>
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ mr: 1 }}>
            <Reloj />
          </Box>
          <BotonTema />
          <form action={salirAction}>
            <Button type="submit" color="inherit" title="Consultar otro presupuesto">
              Salir
            </Button>
          </form>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
