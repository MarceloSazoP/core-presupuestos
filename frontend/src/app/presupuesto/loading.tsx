import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

// Esqueleto con la forma de la pantalla: barra superior, título, «De la visita», la hoja del presupuesto y el resumen. Evita el salto
// de layout mientras carga el presupuesto.
export default function Cargando() {
  return (
    <Box aria-busy="true" aria-label="Cargando presupuesto">
      <Skeleton variant="rectangular" height={72} animation="wave" />
      <Box sx={{ mx: "auto", maxWidth: "84rem", px: { xs: 2, sm: 3, lg: 5 }, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        <Stack spacing={1}>
          <Skeleton variant="text" sx={{ fontSize: "2.125rem", width: "20rem", maxWidth: "100%" }} />
          <Skeleton variant="text" sx={{ width: "28rem", maxWidth: "100%" }} />
        </Stack>
        <Box sx={{ display: "grid", gap: 3, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 21rem", xl: "20rem minmax(0, 1fr) 21rem" } }}>
          <Skeleton variant="rounded" height={260} />
          <Skeleton variant="rounded" height={560} sx={{ display: { xs: "none", xl: "block" } }} />
          <Skeleton variant="rounded" height={360} />
        </Box>
      </Box>
    </Box>
  );
}
