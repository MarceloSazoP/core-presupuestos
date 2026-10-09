"use client";

import { createTheme, type Theme } from "@mui/material/styles";

// Sombra de tres capas del sistema «aurora» (globals.css): lo que flota sobre el lienzo lavanda, solo en claro.
const SOMBRA = "0 4px 15px rgb(97 110 124 / 0.114), inset 0 1px 1px rgb(255 255 255 / 0.39), 0 1px 1px rgb(34 50 94 / 0.08)";

// Títulos: en el oscuro «neón», mayúsculas espaciadas como una pantalla de arcade.
const titulo = ({ theme }: { theme: Theme }) => theme.applyStyles("dark", { textTransform: "uppercase", letterSpacing: "0.08em" });

// Tema de Material UI (/presupuesto y la vista del cliente /q). Claro y oscuro con variables CSS bajo `data-theme` (el mismo atributo que usa el resto de
// la web), así el modo elegido se respeta en todas las páginas. Los fondos son los mismos que el `theme-color` del layout raíz.
// Claro: sistema «aurora» (marino para la acción principal, tarjetas blancas que flotan). Oscuro: sistema «neón» (negro absoluto,
// contornos blancos de 1 px sin sombras, un solo rosado de acción y letra monoespaciada, que llega por `--fuente`).
export const tema = createTheme({
  cssVariables: { colorSchemeSelector: "data-theme" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#3a4766" },
        secondary: { main: "#7d4699" },
        background: { default: "#e0dde2", paper: "#ffffff" },
        text: { primary: "#1d2630", secondary: "#565e80" },
        divider: "#a5afcb",
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
    h1: { letterSpacing: "-0.02em" },
    h2: { letterSpacing: "-0.02em" },
    h3: { letterSpacing: "-0.018em" },
    h4: { letterSpacing: "-0.015em" },
    h5: { letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiTypography: { styleOverrides: { h1: titulo, h2: titulo, h3: titulo, h4: titulo, h5: titulo, h6: titulo } },
    // Claro: píldoras. Neón: radio de 10 px, mayúsculas y espaciado. Ninguno con sombra.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 40,
          borderRadius: 100,
          ...theme.applyStyles("dark", { borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.1em" }),
        }),
      },
    },
    MuiChip: { styleOverrides: { root: ({ theme }) => theme.applyStyles("dark", { borderRadius: 10 }) } },
    MuiPaper: {
      styleOverrides: {
        rounded: ({ theme }) => ({ borderRadius: 18, ...theme.applyStyles("dark", { borderRadius: 15 }) }),
        // Lo que tiene elevación: en claro flota con la sombra de tres capas; en neón el contorno blanco es la tarjeta (sin sombra
        // ni el aclarado que MUI pone en oscuro). Lo delineado (filas) se queda con su borde fino.
        root: ({ ownerState, theme }) => {
          const flota = ownerState.variant !== "outlined" && Boolean(ownerState.elevation);
          return {
            ...(flota ? theme.applyStyles("light", { boxShadow: SOMBRA }) : {}),
            ...theme.applyStyles("dark", {
              backgroundImage: "none",
              ...(flota ? { boxShadow: "none", ...(ownerState.square ? {} : { border: "1px solid #ffffff" }) } : {}),
            }),
          };
        },
      },
    },
  },
});
