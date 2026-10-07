"use client";

import { createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";

const roboto = Roboto({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap" });

// Tema de Material UI (/presupuesto y la vista del cliente /q). Claro y oscuro con variables CSS bajo `data-theme` (el mismo atributo que usa el resto de
// la web), así el modo elegido se respeta en todas las páginas. Los fondos son los mismos que el `theme-color` del layout raíz.
export const tema = createTheme({
  cssVariables: { colorSchemeSelector: "data-theme" },
  colorSchemes: {
    light: { palette: { background: { default: "#f5f6f9" } } },
    // En oscuro el color principal es naranjo (no azul): botones, enlaces, casillas y la grilla de ítems lo toman de aquí. Sobre él
    // MUI pone texto oscuro (más contraste que el blanco).
    dark: { palette: { primary: { main: "#ff8f4d" }, background: { default: "#090a0d", paper: "#14161b" } } },
  },
  typography: { fontFamily: roboto.style.fontFamily },
  components: {
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiButton: { styleOverrides: { root: { minHeight: 40 } } },
  },
});
