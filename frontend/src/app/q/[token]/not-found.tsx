import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

// El enlace de un presupuesto que no existe, quedó cortado o ya no está disponible (la API responde el mismo 404 para todo, Contrato
// API §10): en español y con qué hacer, en vez de la página genérica.
export default function PresupuestoNoEncontrado() {
  return (
    <Box component="main" sx={{ mx: "auto", width: "100%", maxWidth: "36rem", px: 2, py: { xs: 4, sm: 8 } }}>
      <Paper sx={{ p: { xs: 3, sm: 5 }, display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h5" component="h1">
          No encontramos este presupuesto
        </Typography>
        <Typography color="text.secondary">
          Puede que el enlace esté incompleto o que ya no esté disponible. Ábrelo de nuevo desde el correo o el mensaje en que te llegó, o pide a
          quien te lo envió que te lo mande otra vez.
        </Typography>
        <Button href="/" variant="outlined" sx={{ alignSelf: "flex-start" }}>
          Ir al inicio
        </Button>
      </Paper>
    </Box>
  );
}
