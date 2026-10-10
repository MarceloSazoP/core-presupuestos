"use client";

import { createTheme, type Theme } from "@mui/material/styles";

// Títulos: en el oscuro «neón», mayúsculas espaciadas como una pantalla de arcade.
const titulo = ({ theme }: { theme: Theme }) => theme.applyStyles("dark", { textTransform: "uppercase", letterSpacing: "0.08em" });

// Tema de Material UI (/presupuesto y la vista del cliente /q). Claro y oscuro con variables CSS bajo `data-theme` (el mismo atributo que usa el resto de
// la web), así el modo elegido se respeta en todas las páginas. Los fondos son los mismos que el `theme-color` del layout raíz.
// Claro: sistema «Brex» (fondo gris niebla, tarjetas blancas planas con borde fino y sin sombras, 12 px, Inter comprimida y un solo naranjo
// para la acción principal; ver los contrastes en globals.css). Oscuro: sistema «neón» (negro absoluto, contornos blancos de 1 px sin
// sombras, un solo rosado de acción y letra monoespaciada). La letra llega de `--fuente`, que cambia con el modo.
export const tema = createTheme({
  cssVariables: { colorSchemeSelector: "data-theme" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#cc4700", contrastText: "#ffffff" },
        secondary: { main: "#b83f00" },
        background: { default: "#f3f3f7", paper: "#ffffff" },
        text: { primary: "#000000", secondary: "#60646c" },
        divider: "#b9bbc6",
      },
    },
    // #e41c61: el rosado del diseño apenas más hondo, para que el blanco encima y el rosado sobre negro pasen 4,5:1.
    dark: {
      palette: {
        primary: { main: "#e41c61", contrastText: "#ffffff" },
        secondary: { main: "#ff4d88" },
        background: { default: "#000000", paper: "#000000" },
        text: { primary: "#ffffff", secondary: "#b3b3b3" },
        divider: "#333333",
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--fuente), system-ui, sans-serif",
    h1: { letterSpacing: "-0.03em" },
    h2: { letterSpacing: "-0.025em" },
    h3: { letterSpacing: "-0.02em" },
    h4: { letterSpacing: "-0.02em" },
    h5: { letterSpacing: "-0.01em" },
    h6: { letterSpacing: "-0.01em" },
    body1: { letterSpacing: "-0.01em" },
    body2: { letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: "-0.01em" },
  },
  components: {
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiTypography: { styleOverrides: { h1: titulo, h2: titulo, h3: titulo, h4: titulo, h5: titulo, h6: titulo } },
    // 12 px en claro; neón: 10 px, mayúsculas y espaciado. Ninguno con sombra.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 40,
          borderRadius: 12,
          ...theme.applyStyles("dark", { borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.1em" }),
        }),
      },
    },
    // Etiquetas: 6 px en claro (Brex), 10 px en neón.
    MuiChip: { styleOverrides: { root: ({ theme }) => ({ borderRadius: 6, ...theme.applyStyles("dark", { borderRadius: 10 }) }) } },
    MuiPaper: {
      styleOverrides: {
        rounded: ({ theme }) => ({ borderRadius: 12, ...theme.applyStyles("dark", { borderRadius: 15 }) }),
        // Lo que tiene elevación no lleva sombra en ningún modo: en claro lo separa un borde fino gris (sobre el fondo niebla) y en neón el
        // contorno blanco es la tarjeta (sin el aclarado que MUI pone en oscuro). Lo delineado (filas) se queda con su borde de siempre.
        root: ({ ownerState, theme }) => {
          const elevada = ownerState.variant !== "outlined" && Boolean(ownerState.elevation); // sin sombra, también una barra cuadrada
          const flota = elevada && !ownerState.square; // las tarjetas, además, con su borde
          return {
            ...(elevada ? { boxShadow: "none" } : {}),
            ...theme.applyStyles("light", flota ? { border: "1px solid #b9bbc6" } : {}),
            ...theme.applyStyles("dark", { backgroundImage: "none", ...(flota ? { border: "1px solid #ffffff" } : {}) }),
          };
        },
      },
    },
  },
});
