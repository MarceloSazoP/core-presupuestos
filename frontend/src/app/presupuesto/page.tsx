import type { Metadata } from "next";
import LockOutlined from "@mui/icons-material/LockOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { dinero, cant } from "@/lib/formato";
import { paisDe } from "@/lib/paises";
import { simboloUnidad } from "@/lib/opciones";
import { cargarPresupuesto, esFinalizado } from "@/lib/presupuesto";
import { totalLinea } from "@/lib/totales";
import { enlaceWhatsApp, mensajePresupuesto } from "@/lib/whatsapp";
import { Editor } from "./editor";
import { Encabezado } from "./encabezado";
import { ContactoCliente } from "./contacto-cliente";
import { DeLaVisita, Medidas } from "./de-la-visita";
import { Multimedia } from "./multimedia";
import { PanelEnvio } from "./panel-envio";

export const metadata: Metadata = { title: "Presupuesto · CORE Presupuestos" };

const LOGO = "/presupuesto/logo";

// Cambia cuando cambian los datos: con ella como `key`, el editor se vuelve a armar cuando llegan cambios hechos en otro lugar.
const huella = (o: unknown) => {
  let h = 5381;
  for (const c of JSON.stringify(o)) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return String(h);
};

const PAGINA = { mx: "auto", width: "100%", maxWidth: "84rem", px: { xs: 2, sm: 3, lg: 5 }, py: 3, display: "flex", flexDirection: "column", gap: 3 } as const;
const ROTULO = { typography: "overline", color: "text.secondary", lineHeight: 2 } as const;
const SOLO_ANCHO = { display: { xs: "none", sm: "table-cell" } } as const;

export default async function PresupuestoPage() {
  const cargado = await cargarPresupuesto();
  if (!cargado) redirect("/");
  const { presupuesto: p } = cargado;
  const logoSrc = p.profesional.tieneLogo ? LOGO : null;

  // Pendiente: se completa o se edita. Cerrado: solo se ve.
  if (!esFinalizado(p)) {
    const datosEditor = {
      descripcion: p.descripcion,
      version: p.version,
      numeroAnterior: p.numeroAnterior,
      direccion: p.direccion,
      items: p.items,
      descuento: p.descuento,
      conIva: p.conIva,
      moneda: p.moneda,
      impuesto: p.impuesto,
      pais: p.pais,
      garantia: p.garantia,
      validezDias: p.validezDias,
      observaciones: p.observaciones,
      levantamiento: p.levantamiento,
      cliente: { nombre: p.cliente.nombre, correo: p.cliente.correo, telefono: p.cliente.telefono },
    };

    return (
      <>
        <Encabezado profesional={p.profesional} logoSrc={logoSrc} />
        <Box component="main" sx={PAGINA}>
          <h1 className="sr-only">Completar presupuesto</h1>
          <Editor key={huella(datosEditor)} inicial={datosEditor} />
        </Box>
      </>
    );
  }

  // Presupuesto cerrado: se muestran los montos que fijó el servidor, no un cálculo nuevo.
  const { subtotal, descuento, iva, total } = p;
  const clp = (n: number) => dinero(n, p.moneda);
  const whatsappUrl = enlaceWhatsApp(
    p.cliente.telefono,
    mensajePresupuesto({ nombre: p.cliente.nombre, numero: p.numero, total: clp(total), descripcion: p.descripcion, enlace: p.publicUrl ?? "" }),
  );
  const hayVisita = Boolean(p.levantamiento.notas) || p.levantamiento.medidas.length > 0 || p.levantamiento.fotos.length > 0 || p.levantamiento.audios.length > 0;

  return (
    <>
      <Encabezado profesional={p.profesional} logoSrc={logoSrc} />
      <Box component="main" sx={PAGINA}>
        <Stack component="header" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Chip icon={<LockOutlined />} label={`Cerrado${p.version > 1 ? ` · Versión ${p.version}` : ""}`} color="success" variant="outlined" />
          {p.numeroAnterior ? (
            <Typography variant="body2" color="text.secondary">
              Reemplaza al presupuesto {p.numeroAnterior}
            </Typography>
          ) : null}
          {/* El número es la identidad del documento: va como título y el servicio como subtítulo. */}
          <Typography variant="h4" component="h1" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {p.numero}
          </Typography>
          <Typography variant="h6" component="p" sx={{ fontWeight: 400 }}>
            {p.descripcion}
          </Typography>
          <Typography color="text.secondary">Para {p.cliente.nombre}</Typography>
        </Stack>

        {hayVisita ? (
          <DeLaVisita>
            {p.levantamiento.notas ? <Typography sx={{ whiteSpace: "pre-line" }}>{p.levantamiento.notas}</Typography> : null}
            <Medidas medidas={p.levantamiento.medidas} />
            <Multimedia fotos={p.levantamiento.fotos} audios={p.levantamiento.audios} />
          </DeLaVisita>
        ) : null}

        <Box sx={{ display: "grid", gap: 3, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 24rem" } }}>
          {/* Así lo recibe el cliente: los mismos datos del PDF. */}
          <Paper component="section" aria-labelledby="detalle" elevation={2} sx={{ p: { xs: 2, sm: 4 }, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 2 }}>
              <Box>
                <Box sx={ROTULO}>Presupuesto</Box>
                <Typography id="detalle" variant="h5" component="h2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {p.numero}
                </Typography>
              </Box>
              <Box sx={{ maxWidth: "28rem" }}>
                <Box sx={ROTULO}>Servicio</Box>
                <Typography>{p.descripcion}</Typography>
              </Box>
            </Box>

            <Table aria-label="Detalle" sx={{ fontVariantNumeric: "tabular-nums" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 0 }}>Descripción</TableCell>
                  <TableCell align="right" sx={SOLO_ANCHO}>
                    Cant.
                  </TableCell>
                  <TableCell sx={SOLO_ANCHO}>Unidad</TableCell>
                  <TableCell align="right" sx={SOLO_ANCHO}>
                    Precio
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0 }}>
                    Total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {p.items.map((item, i) => {
                  const tarea = item.tipo === "tarea";
                  return (
                    <TableRow key={i}>
                      <TableCell sx={{ pl: 0, overflowWrap: "anywhere" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {tarea ? <Chip label="Tarea" size="small" variant="outlined" /> : null}
                          {item.descripcion}
                        </Box>
                        {tarea ? null : (
                          <Typography variant="body2" color="text.secondary" sx={{ display: { sm: "none" } }}>
                            {cant(item.cantidad)} {simboloUnidad(item.unidad)} × {clp(item.precioUnitario)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={SOLO_ANCHO}>
                        {tarea ? "" : cant(item.cantidad)}
                      </TableCell>
                      <TableCell sx={SOLO_ANCHO}>{tarea ? "" : simboloUnidad(item.unidad)}</TableCell>
                      <TableCell align="right" sx={SOLO_ANCHO}>
                        {tarea ? "" : clp(item.precioUnitario)}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0, fontWeight: 500 }}>
                        {tarea ? (item.precioUnitario > 0 ? clp(item.precioUnitario) : "Incluido") : clp(totalLinea(item.cantidad, item.precioUnitario))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Stack component="dl" spacing={0.75} sx={{ m: 0, ml: "auto", width: "min(100%, 20rem)", fontVariantNumeric: "tabular-nums" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", color: "text.secondary" }}>
                <dt>Subtotal</dt>
                <Box component="dd" sx={{ m: 0 }}>
                  {clp(subtotal)}
                </Box>
              </Box>
              {descuento > 0 ? (
                <Box sx={{ display: "flex", justifyContent: "space-between", color: "text.secondary" }}>
                  <dt>Descuento</dt>
                  <Box component="dd" sx={{ m: 0 }}>
                    -{clp(descuento)}
                  </Box>
                </Box>
              ) : null}
              {p.conIva ? (
                <Box sx={{ display: "flex", justifyContent: "space-between", color: "text.secondary" }}>
                  <dt>
                    {p.impuesto.nombre} ({p.impuesto.tasa}%)
                  </dt>
                  <Box component="dd" sx={{ m: 0 }}>
                    {clp(iva)}
                  </Box>
                </Box>
              ) : null}
              <Divider />
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <Box component="dt" sx={{ fontWeight: 500 }}>
                  Total
                </Box>
                <Box component="dd" sx={{ m: 0, typography: "h5" }}>
                  {clp(total)}
                </Box>
              </Box>
            </Stack>

            <Divider />
            <Box component="dl" sx={{ m: 0, display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
              <div>
                <Box component="dt" sx={ROTULO}>
                  Garantía
                </Box>
                <Box component="dd" sx={{ m: 0 }}>
                  {p.garantia}
                </Box>
              </div>
              <div>
                <Box component="dt" sx={ROTULO}>
                  Validez
                </Box>
                <Box component="dd" sx={{ m: 0 }}>
                  {p.validezDias} días
                </Box>
              </div>
              {p.observaciones ? (
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <Box component="dt" sx={ROTULO}>
                    Observaciones
                  </Box>
                  <Box component="dd" sx={{ m: 0, whiteSpace: "pre-line" }}>
                    {p.observaciones}
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Paper>

          <Stack spacing={3} sx={{ position: { lg: "sticky" }, top: { lg: 24 }, minWidth: 0 }}>
            <PanelEnvio nombre={p.cliente.nombre} whatsappUrl={whatsappUrl} enlace={p.publicUrl} correo={p.cliente.correo} />
            <Card component="section" aria-labelledby="cliente-cerrado">
              <CardContent>
                <Typography id="cliente-cerrado" variant="h6" component="h2" sx={{ mb: 1.5 }}>
                  Contacto del cliente
                </Typography>
                <ContactoCliente nombre={p.cliente.nombre} telefono={p.cliente.telefono} correo={p.cliente.correo} prefijo={paisDe(p.pais).calling_code} />
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>
    </>
  );
}
