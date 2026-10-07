import type { Metadata } from "next";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { porcentajeDe } from "@/lib/descuento";
import { cant, dinero } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";
import { LogoProfesional } from "./logo-profesional";

export const metadata: Metadata = { title: "Presupuesto · CORE Presupuestos", robots: { index: false, follow: false } };

// Vista pública del cliente (Contrato API §10): solo lectura, sin cuenta. Se abre sobre todo en el teléfono, desde el
// enlace que llega por WhatsApp o correo.
type Publico = {
  number: string;
  version?: number;
  previous_number?: string | null;
  finalized_at: string;
  issued_on: string | null;
  valid_until: string;
  timezone: string;
  currency: string;
  vat_label: string;
  professional: { name: string; phone: string; email: string; has_logo: boolean };
  customer: { name: string };
  service_description: string;
  service_address: string | null;
  items: { kind?: "ITEM" | "TASK"; description: string; quantity: number; unit: string; unit_price: number; line_total: number }[];
  subtotal: number;
  discount: number;
  include_vat: boolean;
  vat: number;
  vat_rate: number;
  total: number;
  warranty: { text: string };
  validity_days: number;
  observations: string | null;
};

// La fecha de emisión es la fijada al terminar (en la zona de quien emitió); los presupuestos anteriores solo traen la hora.
const fecha = (iso: string, zona: string) => new Date(iso).toLocaleDateString("es-CL", { timeZone: zona, dateStyle: "long" });
const dia = (ymd: string) => fecha(`${ymd}T12:00:00Z`, "UTC");

const ROTULO = { typography: "overline", color: "text.secondary", lineHeight: 2 } as const;
const FILA_TOTAL = { display: "flex", justifyContent: "space-between", gap: 2, color: "text.secondary" } as const;

export default async function VistaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let q: Publico;
  try {
    q = await api<Publico>(`/public/quotes/${encodeURIComponent(token)}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 429)) notFound();
    throw e;
  }
  const base = `/q/${encodeURIComponent(token)}`;
  const clp = (n: number) => dinero(n, q.currency); // los montos, con la moneda del presupuesto
  const porcentajeDescuento = porcentajeDe(q.discount, q.subtotal); // null: un monto fijo, sin porcentaje que mostrar

  return (
    <Box component="main" sx={{ mx: "auto", width: "100%", maxWidth: "52rem", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 4 }, display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper component="article" elevation={2} sx={{ p: { xs: 2.5, sm: 5 }, display: "flex", flexDirection: "column", gap: 3 }}>
        <Box component="header" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2.5, pb: 2.5, borderBottom: 2, borderColor: "text.primary" }}>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            {/* El logo va en su propia fila, encima del nombre: un logo horizontal se ve entero y sin deformarse. */}
            {q.professional.has_logo ? <LogoProfesional src={`${base}/logo`} nombre={q.professional.name} /> : null}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="p">
                {q.professional.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", flexWrap: "wrap", columnGap: 2 }}>
                <Link href={`tel:${q.professional.phone}`} color="inherit" underline="hover">
                  {q.professional.phone}
                </Link>
                <Link href={`mailto:${q.professional.email}`} color="inherit" underline="hover" sx={{ wordBreak: "break-all" }}>
                  {q.professional.email}
                </Link>
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ textAlign: { sm: "right" }, flexShrink: 0 }}>
            <Box sx={ROTULO}>Presupuesto</Box>
            <Typography variant="h5" component="h1" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {q.number}
            </Typography>
            {(q.version ?? 1) > 1 ? <Chip label={`Versión ${q.version}`} size="small" variant="outlined" sx={{ mt: 0.5 }} /> : null}
            {q.previous_number ? (
              <Typography variant="body2" color="text.secondary">
                Reemplaza al presupuesto {q.previous_number}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              {q.issued_on ? dia(q.issued_on) : fecha(q.finalized_at, q.timezone)}
            </Typography>
          </Box>
        </Box>

        <Box component="section" aria-label="Cliente y servicio" sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1.4fr)" } }}>
          <Box>
            <Box sx={ROTULO}>Para</Box>
            <Typography sx={{ fontWeight: 500 }}>{q.customer.name}</Typography>
            {q.service_address ? (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                {q.service_address}
              </Typography>
            ) : null}
          </Box>
          <Box>
            <Box sx={ROTULO}>Servicio</Box>
            <Typography variant="h6" component="p" sx={{ fontWeight: 400, lineHeight: 1.4, overflowWrap: "anywhere" }}>
              {q.service_description}
            </Typography>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="detalle">
          <Typography id="detalle" variant="overline" component="h2" color="text.secondary">
            Detalle
          </Typography>
          <Stack component="ul" divider={<Divider component="li" aria-hidden="true" />} sx={{ m: 0, p: 0, listStyle: "none", borderTop: 1, borderBottom: 1, borderColor: "divider" }}>
            {q.items.map((i, n) => (
              <Box component="li" key={n} sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, py: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflowWrap: "anywhere" }}>
                    {i.kind === "TASK" ? <Chip label="Tarea" size="small" variant="outlined" /> : null}
                    <Typography component="span">{i.description}</Typography>
                  </Box>
                  {i.kind !== "TASK" ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {cant(i.quantity)} {simboloUnidad(i.unit)} × {clp(i.unit_price)}
                    </Typography>
                  ) : null}
                </Box>
                <Typography sx={{ flexShrink: 0, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{i.kind === "TASK" && i.line_total === 0 ? "Incluido" : clp(i.line_total)}</Typography>
              </Box>
            ))}
          </Stack>
          <Stack component="dl" spacing={0.75} sx={{ m: 0, mt: 2, ml: { sm: "auto" }, width: { sm: "20rem" }, fontVariantNumeric: "tabular-nums" }}>
            <Box sx={FILA_TOTAL}>
              <dt>Subtotal</dt>
              <Box component="dd" sx={{ m: 0 }}>
                {clp(q.subtotal)}
              </Box>
            </Box>
            {q.discount > 0 ? (
              <Box sx={FILA_TOTAL}>
                <dt>Descuento{porcentajeDescuento ? ` (${porcentajeDescuento} %)` : ""}</dt>
                <Box component="dd" sx={{ m: 0 }}>
                  -{clp(q.discount)}
                </Box>
              </Box>
            ) : null}
            {q.include_vat ? (
              <Box sx={FILA_TOTAL}>
                <dt>
                  {q.vat_label} ({q.vat_rate}%)
                </dt>
                <Box component="dd" sx={{ m: 0 }}>
                  {clp(q.vat)}
                </Box>
              </Box>
            ) : null}
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, mt: 0.5, pt: 1, borderTop: 2, borderColor: "text.primary" }}>
              <Box component="dt" sx={{ fontWeight: 700, textTransform: "uppercase" }}>
                Total
              </Box>
              <Box component="dd" sx={{ m: 0, typography: "h4", fontWeight: 500 }}>
                {clp(q.total)}
              </Box>
            </Box>
          </Stack>
        </Box>

        <Box component="dl" aria-label="Condiciones" sx={{ m: 0, display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, pt: 2.5, borderTop: 1, borderColor: "divider" }}>
          <div>
            <Box component="dt" sx={ROTULO}>
              Garantía
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              {q.warranty.text}
            </Box>
          </div>
          <div>
            <Box component="dt" sx={ROTULO}>
              Validez
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              {q.validity_days} días (hasta el {dia(q.valid_until)})
            </Box>
          </div>
          {q.observations ? (
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Box component="dt" sx={ROTULO}>
                Observaciones
              </Box>
              <Box component="dd" sx={{ m: 0, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {q.observations}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Paper>

      {/* En pantallas anchas el botón va bajo el documento; en el teléfono, en una barra fija abajo (siempre a mano). */}
      <Button href={`${base}/pdf`} download variant="contained" size="large" startIcon={<FileDownloadOutlined />} sx={{ display: { xs: "none", sm: "inline-flex" }, alignSelf: "center", px: 4 }}>
        Descargar PDF
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        Presupuesto comercial. No es un documento tributario.
      </Typography>

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
            {clp(q.total)}
          </Typography>
        </Box>
        <Button href={`${base}/pdf`} download variant="contained" startIcon={<FileDownloadOutlined />}>
          Descargar PDF
        </Button>
      </Paper>
    </Box>
  );
}
