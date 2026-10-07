"use client";

import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { tema } from "./tema";

// Material UI en /presupuesto y en la vista del cliente. Los estilos de MUI van en `@layer mui` (ver globals.css): así las clases de Tailwind que aún
// quedan pueden sobreescribirlos. El modo claro/oscuro se guarda en la misma clave («tema») que el resto de la web.
export function ProveedorMui({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={tema} modeStorageKey="tema" disableTransitionOnChange>
        <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", color: "text.primary", typography: "body1" }}>{children}</Box>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
