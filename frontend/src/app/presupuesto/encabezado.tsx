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
import { useState } from "react";
import { salirAction } from "../actions";
import { Reloj } from "../reloj";
import { ANCHO_PAGINA } from "./medidas";

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

// Dueño del presupuesto (usuario de la app móvil): logo, nombre y contacto, con la fecha y hora en vivo. La barra es del color de
// la superficie (no azul) para que cualquier logo se vea como fue diseñado; el logo conserva su proporción (los horizontales se ven
// completos), va pegado a la izquierda y, en el teléfono, en su propia fila arriba del nombre.
export function Encabezado({ profesional, logoSrc }: { profesional: Profesional; logoSrc: string | null }) {
  const telefono = profesional.telefono.replace(/[^\d+]/g, "");
  const [logoRoto, setLogoRoto] = useState(false); // si el logo no carga, van las iniciales en vez de una imagen rota
  const logo = logoRoto ? null : logoSrc;
  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
      <Toolbar sx={{ mx: "auto", width: "100%", maxWidth: ANCHO_PAGINA, flexWrap: "wrap", alignItems: "center", columnGap: 3, rowGap: 1.5, py: 1.5, px: { xs: 2, sm: 3, lg: 5 } }}>
        {logo ? (
          <Box sx={{ flex: { xs: "1 1 100%", sm: "0 0 auto" }, display: "flex", minWidth: 0 }}>
            {/* Sobre fondo oscuro el logo va en una placa blanca: casi todos se diseñan para fondo claro. */}
            <Box sx={(t) => ({ display: "flex", maxWidth: "100%", ...t.applyStyles("dark", { bgcolor: "common.white", borderRadius: 1, px: 1, py: 0.5 }) })}>
              {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF; su proporción es la del logo */}
              <img src={logo} alt={`Logo de ${profesional.nombre}`} onError={() => setLogoRoto(true)} style={{ display: "block", height: 56, width: "auto", maxWidth: "min(18rem, 100%)", objectFit: "contain", objectPosition: "left center" }} />
            </Box>
          </Box>
        ) : (
          <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>{iniciales(profesional.nombre)}</Avatar>
        )}
        <Box sx={{ minWidth: 0, flex: "1 1 14rem", pl: { sm: logo ? 3 : 0 }, borderLeft: { sm: logo ? 1 : 0 }, borderColor: { sm: "divider" } }}>
          <Typography component="p" variant="h6" noWrap>
            {profesional.nombre}
          </Typography>
          <Typography component="p" variant="body2" color="text.secondary" sx={{ display: "flex", flexWrap: "wrap", columnGap: 2 }}>
            <Link href={`tel:${telefono}`} color="inherit" underline="hover">
              {profesional.telefono}
            </Link>
            <Link href={`mailto:${profesional.correo}`} color="inherit" underline="hover" sx={{ wordBreak: "break-all" }}>
              {profesional.correo}
            </Link>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
          <Box sx={{ mr: 1 }}>
            <Reloj />
          </Box>
          <BotonTema />
          <form action={salirAction}>
            <Button type="submit" variant="outlined" title="Consultar otro presupuesto">
              Salir
            </Button>
          </form>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
