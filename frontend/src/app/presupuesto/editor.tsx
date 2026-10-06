"use client";

import Add from "@mui/icons-material/Add";
import MailOutline from "@mui/icons-material/MailOutlined";
import Save from "@mui/icons-material/SaveOutlined";
import Send from "@mui/icons-material/Send";
import Visibility from "@mui/icons-material/VisibilityOutlined";
import WhatsApp from "@mui/icons-material/WhatsApp";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { avisar, useAvisar } from "../avisos";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { montoDeDescuento, porcentajeDe } from "@/lib/descuento";
import { dinero } from "@/lib/formato";
import { paisDe } from "@/lib/paises";
import { GARANTIAS, UNIDAD_POR_DEFECTO, VALIDEZ_DIAS } from "@/lib/opciones";
import { calcularTotales } from "@/lib/totales";
import { completarPresupuestoAction, type EstadoEdicion } from "../actions";
import { ContactoCliente } from "./contacto-cliente";
import { NotasVisita } from "./notas-visita";
import { CamposItems, GrillaItems, type Fila } from "./grilla-items";
import { ListaItemsMovil, useEsAngosto } from "./lista-items-movil";
import { DeLaVisita, Medidas } from "./de-la-visita";
import { Multimedia } from "./multimedia";
import { PanelEnvio } from "./panel-envio";

type Inicial = {
  descripcion: string;
  version: number;
  numeroAnterior: string | null;
  direccion: string | null;
  items: { tipo: "item" | "tarea"; descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
  descuento: number;
  conIva: boolean;
  moneda: string;
  impuesto: { nombre: string; tasa: number };
  pais: string;
  garantia: string;
  validezDias: number;
  observaciones: string | null;
  levantamiento: { notas: string | null; medidas: { etiqueta: string; valor: string }[]; fotos: string[]; audios: { id: string; segundos: number }[] };
  cliente: { nombre: string; correo: string | null; telefono: string };
};

// Solo para la vista previa: el servidor vuelve a calcular y valida todo.
const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
const MAX_ITEMS = 100; // igual que el servidor
const PORCENTAJES = Array.from({ length: 101 }, (_, i) => i); // 0 % a 100 %, como la rueda de la app
const filaVacia = (clave: number, tipo: Fila["tipo"] = "item"): Fila => ({ clave, tipo, descripcion: "", cantidad: "1", unidad: UNIDAD_POR_DEFECTO, precio: "" });

export function Editor({ inicial }: { inicial: Inicial }) {
  const [estado, accion, pendiente] = useActionState<EstadoEdicion, FormData>(completarPresupuestoAction, {});
  useAvisar(estado, () => estado.errores && avisar("error", "Revisa el presupuesto", estado.errores?.join(" · ")));
  useAvisar(estado, () => estado.guardado && avisar("exito", "Guardado", estado.guardado));
  useAvisar(estado, () => {
    const t = estado.terminado;
    if (!t) return;
    avisar("exito", `Presupuesto ${t.numero} terminado`, `Total ${t.total}`);
    if (!t.correo.ok && inicial.cliente.correo) avisar("error", "El correo no se pudo enviar", t.correo.mensaje); // sin correo del cliente no es un error
  });
  const { moneda, impuesto } = inicial; // los montos de este presupuesto, con su moneda y su impuesto
  const clp = (n: number) => dinero(n, moneda);
  const [, enTransicion] = useTransition();
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicial.items.length > 0
      ? inicial.items.map((it, i) => ({
          clave: i + 1,
          tipo: it.tipo,
          descripcion: it.descripcion,
          cantidad: String(it.cantidad).replace(".", ","),
          unidad: it.unidad,
          precio: it.tipo === "tarea" && it.precioUnitario === 0 ? "" : String(it.precioUnitario), // una tarea incluida se muestra sin valor
        }))
      : [filaVacia(1)],
  );
  // El descuento se elige en porcentaje, como en la app; null es un monto fijo guardado antes, que se respeta hasta elegir uno.
  const [porcentaje, setPorcentaje] = useState<number | null>(() =>
    porcentajeDe(inicial.descuento, calcularTotales(inicial.items.map((it) => ({ ...it })), 0, false, inicial.impuesto.tasa).subtotal),
  );
  const [servicio, setServicio] = useState(inicial.descripcion);
  const [conIva, setConIva] = useState(inicial.conIva);
  const [direccion, setDireccion] = useState(inicial.direccion ?? "");
  const [garantia, setGarantia] = useState(inicial.garantia);
  const [validez, setValidez] = useState(String(inicial.validezDias));
  const [observaciones, setObservaciones] = useState(inicial.observaciones ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [intentoTerminar, setIntentoTerminar] = useState(false);
  const router = useRouter();
  const esAngosto = useEsAngosto(); // en el teléfono los ítems se editan como tarjetas (la grilla esconde el precio)
  const [hayNovedad, setHayNovedad] = useState(false);
  // En vivo: cuando alguien cambia el presupuesto desde otro lugar (la app), se recarga solo; si aquí hay cambios sin guardar no se
  // pisa nada y se avisa. Los avisos de nuestro propio guardado se ignoran.
  const estadoActual = JSON.stringify([filas, porcentaje, servicio, conIva, direccion, garantia, validez, observaciones]);
  const vivo = useRef({ actual: estadoActual, base: estadoActual, ignorarHasta: 0 });
  useEffect(() => {
    vivo.current.actual = estadoActual;
  }, [estadoActual]);
  useEffect(() => {
    if (pendiente) return;
    vivo.current.base = vivo.current.actual;
    vivo.current.ignorarHasta = Date.now() + 2500;
  }, [pendiente]);
  useEffect(() => {
    const es = new EventSource("/presupuesto/eventos");
    es.addEventListener("changed", () => {
      const v = vivo.current;
      if (Date.now() < v.ignorarHasta) return;
      if (v.actual !== v.base) setHayNovedad(true);
      else router.refresh();
    });
    return () => es.close();
  }, [router]);
  const formulario = useRef<HTMLFormElement>(null);
  const ventana = useRef<Window | null>(null);
  const [sinVentana, setSinVentana] = useState(false); // el navegador bloqueó la pestaña nueva: se ofrece un enlace
  // La vista previa se abre en otra pestaña que se crea al hacer clic (si no, el navegador la bloquea) y se completa cuando el guardado termina.
  useEffect(() => {
    const w = ventana.current;
    if (!w) return;
    ventana.current = null;
    if (estado.vistaPrevia) w.location.href = `/presupuesto/vista-previa?t=${estado.vistaPrevia}`;
    else w.close(); // el guardado falló (faltan datos): los errores se ven aquí
  }, [estado]);
  const previsualizar = () => {
    const f = formulario.current;
    if (!f) return;
    const w = window.open("", "_blank");
    w?.document.write('<p style="font-family:sans-serif;padding:2rem">Generando la vista previa…</p>');
    ventana.current = w;
    setSinVentana(!w);
    vivo.current.ignorarHasta = Date.now() + 30_000;
    const datos = new FormData(f);
    datos.set("accion", "previsualizar");
    enTransicion(() => accion(datos));
  };
  // El total de la barra fija solo se muestra cuando el resumen (con el mismo total) no está a la vista: así no aparece dos veces.
  const resumen = useRef<HTMLDivElement>(null);
  const [resumenVisible, setResumenVisible] = useState(false);
  useEffect(() => {
    const el = resumen.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setResumenVisible(e!.isIntersecting), { rootMargin: "0px 0px -72px 0px" }); // lo tapado por la barra no cuenta
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // <form action> reinicia el formulario al terminar y los <select> vuelven a su valor inicial en pantalla (y se
  // reenviaría el viejo). Enviando con onSubmit y una transición no hay reinicio. method="post" evita que, si el envío
  // ocurre antes de cargar el JavaScript, los datos viajen en la URL.
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    vivo.current.ignorarHasta = Date.now() + 30_000; // hasta que termine el guardado, sus avisos son nuestros
    setConfirmando(false);
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    enTransicion(() => accion(datos));
    // El servidor ya ignoró las filas en blanco (Enter deja una al final): también se quitan de la grilla, dejando una si no queda ninguna.
    setFilas((actuales) => {
      const llenas = actuales.filter((f) => f.descripcion.trim() || f.precio.trim());
      return llenas.length > 0 ? llenas : actuales.slice(0, 1);
    });
  };

  const agregar = (tipo: Fila["tipo"] = "item") =>
    setFilas((actuales) => (actuales.length >= MAX_ITEMS ? actuales : [...actuales, filaVacia(Math.max(...actuales.map((f) => f.clave)) + 1, tipo)]));

  // Enter nunca envía el formulario (terminar es irreversible): en un campo suelto pasa al siguiente. La grilla maneja el suyo.
  const alPulsarTecla = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") return setConfirmando(false);
    if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement) || e.target.closest(".ag-root-wrapper")) return;
    e.preventDefault();
    const campos = [...e.currentTarget.elements].filter(
      // Solo controles que reciben foco: los <fieldset> del borde de los campos de MUI también están en form.elements.
      (el): el is HTMLElement => el instanceof HTMLElement && el.matches("input:not([type=hidden]), select, textarea, button") && !el.matches(":disabled, .ag-root-wrapper *"),
    );
    campos[campos.indexOf(e.target) + 1]?.focus();
  };

  // Una tarea no necesita precio (puede ir incluida); un ítem sí.
  const sinItems = filas.every((f) => !f.descripcion.trim() || (f.tipo === "item" && !f.precio.trim()));
  const lineas = filas.map((f) => ({ tipo: f.tipo, descripcion: f.descripcion, cantidad: aNumero(f.cantidad), precioUnitario: aEntero(f.precio) }));
  // El monto se recalcula con el subtotal de ahora; la API guarda el monto (la misma regla que la app).
  const descuento = porcentaje === null ? inicial.descuento : montoDeDescuento(calcularTotales(lineas, 0).subtotal, porcentaje);
  const totales = calcularTotales(lineas, descuento, conIva, impuesto.tasa);
  const descuentoExcesivo = totales.total < 0;

  const intentarTerminar = () => {
    setIntentoTerminar(true);
    if (!sinItems && !descuentoExcesivo) setConfirmando(true);
  };

  if (estado.terminado) {
    const { numero, total, correo, whatsappUrl, enlace } = estado.terminado;
    return (
      <Stack spacing={3} sx={{ width: "100%", maxWidth: "48rem" }}>
        <Alert variant="filled" severity="success">
          <AlertTitle component="h2" variant="h6" sx={{ mb: 0 }}>
            Presupuesto {numero} terminado
          </AlertTitle>
          Para {inicial.cliente.nombre} · Total {total}
        </Alert>
        <PanelEnvio nombre={inicial.cliente.nombre} whatsappUrl={whatsappUrl} enlace={enlace} correo={inicial.cliente.correo} resultadoCorreo={correo} />
        <Button href="/presupuesto" sx={{ alignSelf: "flex-start" }}>
          Ver presupuesto
        </Button>
      </Stack>
    );
  }

  // Pantallas anchas: [de la visita / hoja] a la izquierda y el resumen con el total y las acciones fijo a la derecha. Más angostas:
  // una columna en ese mismo orden y una barra fija abajo con el total y la acción principal.
  return (
    <Box
      component="form"
      id="form-presupuesto"
      ref={formulario}
      method="post"
      onSubmit={enviar}
      onKeyDown={alPulsarTecla}
      sx={{
        display: "grid",
        gap: 3,
        alignItems: "start",
        // La hoja nunca comparte el ancho con «De la visita»: la grilla de ítems necesita todo el espacio.
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 22rem" },
        gridTemplateAreas: {
          xs: '"cabecera" "visita" "hoja" "resumen" "extra" "barra"',
          lg: '"cabecera cabecera" "visita resumen" "hoja resumen"',
        },
      }}
    >
      <Stack spacing={2} sx={{ gridArea: "cabecera", minWidth: 0 }}>
        {hayNovedad ? (
          <Alert
            severity="warning"
            role="status"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setHayNovedad(false);
                  router.refresh();
                }}
              >
                Actualizar (se pierde lo que no guardaste)
              </Button>
            }
          >
            Hay cambios nuevos hechos desde otro lugar.
          </Alert>
        ) : null}
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
              <Typography variant="h4" component="h2" sx={{ fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>
                Presupuesto de {inicial.cliente.nombre}
              </Typography>
              <Chip label={`Borrador${inicial.version > 1 ? ` · Versión ${inicial.version}` : ""}`} color="warning" size="small" />
            </Box>
            {inicial.numeroAnterior ? (
              <Typography variant="body2" color="text.secondary">
                Reemplaza al presupuesto {inicial.numeroAnterior}
              </Typography>
            ) : null}
            <Typography color="text.secondary" sx={{ maxWidth: "62ch" }}>
              Lo que completes en la hoja sale en el PDF del cliente. Lo que anotaste en la visita es solo para ti.
            </Typography>
          </Stack>
          <Stepper activeStep={1} aria-label="Avance del presupuesto" sx={{ display: { xs: "none", md: "flex" }, minWidth: "24rem" }}>
            <Step>
              <StepLabel>En terreno</StepLabel>
            </Step>
            <Step>
              <StepLabel>Presupuesta</StepLabel>
            </Step>
            <Step>
              <StepLabel>Envía</StepLabel>
            </Step>
          </Stepper>
        </Box>
      </Stack>

      <Box sx={{ gridArea: "visita", minWidth: 0 }}>
        <DeLaVisita>
          <NotasVisita notas={inicial.levantamiento.notas} />
          <Medidas medidas={inicial.levantamiento.medidas} />
          <Multimedia fotos={inicial.levantamiento.fotos} audios={inicial.levantamiento.audios} editable />
        </DeLaVisita>
      </Box>

      {/* La hoja: lo que recibe el cliente, en el orden del PDF. */}
      <Paper component="section" aria-label="Hoja del presupuesto" sx={{ gridArea: "hoja", minWidth: 0, overflow: "hidden" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 3, px: { xs: 2, sm: 3 }, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="overline" color="text.secondary">
            Presupuesto · borrador
          </Typography>
          <Typography variant="body2" color="text.secondary">
            El número y la fecha se asignan al terminar
          </Typography>
        </Box>
        <Stack spacing={4} sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack component="section" aria-labelledby="cliente" spacing={1}>
            <Typography id="cliente" variant="h6" component="h3">
              Cliente
            </Typography>
            <ContactoCliente nombre={inicial.cliente.nombre} telefono={inicial.cliente.telefono} correo={inicial.cliente.correo} prefijo={paisDe(inicial.pais).calling_code} />
          </Stack>

          {/* Servicio y dirección son un solo grupo: más cerca entre sí que del resto. */}
          <Stack component="section" aria-labelledby="titulo-servicio" spacing={2.5}>
            <Typography id="titulo-servicio" variant="h6" component="h3">
              Servicio
            </Typography>
            <TextField
              id="descripcion"
              name="descripcion"
              label="Qué trabajo se va a hacer"
              multiline
              minRows={2}
              autoFocus={!servicio.trim()}
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            <TextField
              id="direccion"
              name="direccion"
              label="Dirección del trabajo"
              autoComplete="off"
              placeholder="Calle, número y comuna"
              helperText="Opcional"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />
          </Stack>

          <Stack component="section" aria-labelledby="titulo-items" spacing={1.5}>
            <Typography id="titulo-items" variant="h6" component="h3">
              Ítems y tareas
            </Typography>
            {esAngosto ? <ListaItemsMovil moneda={moneda} filas={filas} onChange={setFilas} /> : <GrillaItems moneda={moneda} filas={filas} onChange={setFilas} onAgregar={() => agregar("item")} />}
            <CamposItems filas={filas} />
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, ml: -1 }}>
              <Button startIcon={<Add />} onClick={() => agregar("item")}>
                Agregar ítem
              </Button>
              <Button startIcon={<Add />} onClick={() => agregar("tarea")} title="Una actividad sin cantidad ni unidad, por ejemplo botar escombros">
                Agregar tarea
              </Button>
              {esAngosto ? null : (
                <Typography variant="caption" color="text.secondary">
                  Enter pasa a la celda siguiente y, al final, crea otra fila.
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack component="section" aria-labelledby="titulo-condiciones" spacing={2.5}>
            <Typography id="titulo-condiciones" variant="h6" component="h3">
              Condiciones
            </Typography>
            <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
              <TextField select id="garantia" name="garantia" label="Garantía" value={garantia} onChange={(e) => setGarantia(e.target.value)} slotProps={{ select: { native: true } }}>
                {GARANTIAS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </TextField>
              <TextField select id="validezDias" name="validezDias" label="Validez del presupuesto" value={validez} onChange={(e) => setValidez(e.target.value)} slotProps={{ select: { native: true } }}>
                {VALIDEZ_DIAS.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </TextField>
            </Box>
            <TextField
              id="observaciones"
              name="observaciones"
              label="Observaciones"
              multiline
              minRows={3}
              placeholder="Aclaraciones para el cliente"
              helperText="Opcional"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 5000 } }}
            />
          </Stack>
        </Stack>
      </Paper>

      <Card ref={resumen} component="aside" aria-labelledby="titulo-resumen" elevation={3} sx={{ gridArea: "resumen", minWidth: 0, position: { lg: "sticky" }, top: { lg: 24 } }}>
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Typography id="titulo-resumen" variant="h6" component="h3">
            Resumen
          </Typography>
          <Stack component="dl" spacing={1.5} sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, color: "text.secondary" }}>
              <dt>Subtotal</dt>
              <Box component="dd" sx={{ m: 0 }}>
                {clp(totales.subtotal)}
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Box component="dt" sx={{ color: "text.secondary" }}>
                Descuento
              </Box>
              <Box component="dd" sx={{ m: 0, width: "11rem" }}>
                <TextField
                  select
                  id="descuento-porcentaje"
                  label="Porcentaje"
                  size="small"
                  value={porcentaje === null ? "fijo" : String(porcentaje)}
                  onChange={(e) => setPorcentaje(e.target.value === "fijo" ? null : Number(e.target.value))}
                  error={descuentoExcesivo}
                  slotProps={{ select: { native: true }, htmlInput: { "aria-invalid": descuentoExcesivo } }}
                >
                  {porcentaje === null ? <option value="fijo">Fijo {clp(inicial.descuento)}</option> : null}
                  {PORCENTAJES.map((p) => (
                    <option key={p} value={p}>
                      {p === 0 ? "Sin descuento" : `${p} %`}
                    </option>
                  ))}
                </TextField>
                {/* La API recibe el monto. */}
                <input type="hidden" name="descuento" value={String(descuento)} />
              </Box>
            </Box>
            {descuento > 0 ? (
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, color: "text.secondary" }}>
                <dt>Descuento{porcentaje ? ` (${porcentaje} %)` : ""}</dt>
                <Box component="dd" sx={{ m: 0 }}>
                  -{clp(descuento)}
                </Box>
              </Box>
            ) : null}
            <Box component="div" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <dt className="sr-only">Impuesto</dt>
              <Box component="dd" sx={{ m: 0, flex: 1 }}>
                <FormControlLabel
                  control={<Checkbox id="iva" name="iva" value="1" checked={conIva} onChange={(e) => setConIva(e.target.checked)} />}
                  label={`Agregar ${impuesto.nombre} (${impuesto.tasa}%)`}
                  labelPlacement="start"
                  sx={{ m: 0, mr: -1.5, width: "calc(100% + 12px)", justifyContent: "space-between" }}
                />
              </Box>
            </Box>
            {conIva ? (
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, color: "text.secondary" }}>
                <dt>
                  {impuesto.nombre} ({impuesto.tasa}%)
                </dt>
                <Box component="dd" sx={{ m: 0 }}>
                  {clp(totales.iva)}
                </Box>
              </Box>
            ) : null}
            <Divider />
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}>
              <Box component="dt" sx={{ typography: "subtitle1", fontWeight: 500 }}>
                Total
              </Box>
              <Box component="dd" aria-live="polite" sx={{ m: 0, typography: "h4", color: descuentoExcesivo ? "error.main" : "text.primary" }}>
                {clp(totales.total)}
              </Box>
            </Box>
          </Stack>

          {descuentoExcesivo ? <Alert severity="error">El descuento no puede superar el subtotal.</Alert> : null}
          {estado.errores ? (
            <Alert severity="error" role="alert">
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {estado.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </Box>
            </Alert>
          ) : null}
          {intentoTerminar && sinItems ? (
            <Alert severity="error" role="alert">
              Agrega al menos un ítem con descripción y precio.
            </Alert>
          ) : null}
          {sinVentana && estado.vistaPrevia ? (
            <Alert severity="info" role="status">
              El navegador bloqueó la pestaña nueva.{" "}
              <Link href={`/presupuesto/vista-previa?t=${estado.vistaPrevia}`} target="_blank" rel="noopener" sx={{ fontWeight: 500 }}>
                Abrir la vista previa
              </Link>
            </Alert>
          ) : null}
          {estado.guardado ? (
            <Alert severity="success" role="status">
              {estado.guardado}
            </Alert>
          ) : null}

          <Box component="section" aria-label="A quién se envía" sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Al terminar se envía a
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <MailOutline color="action" />
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {inicial.cliente.correo ? (
                  <>
                    {inicial.cliente.correo}
                    <Typography component="span" variant="body2" color="text.secondary">
                      {" "}
                      · con el PDF
                    </Typography>
                  </>
                ) : (
                  <Typography component="span" variant="body2" color="text.secondary">
                    Sin correo: se cerrará sin enviarlo
                  </Typography>
                )}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <WhatsApp color="action" />
              <Typography variant="body2">
                {inicial.cliente.telefono}
                <Typography component="span" variant="body2" color="text.secondary">
                  {" "}
                  · WhatsApp, cuando tú lo abras
                </Typography>
              </Typography>
            </Box>
          </Box>

          {/* En pantallas anchas las acciones viven aquí, junto al total; en las demás, en la barra fija de abajo. */}
          <Stack spacing={1} sx={{ display: { xs: "none", lg: "flex" } }}>
            <Button variant="contained" size="large" startIcon={<Send />} loading={pendiente} loadingPosition="start" onClick={intentarTerminar}>
              {pendiente ? "Procesando…" : "Terminar y enviar"}
            </Button>
            <Button type="submit" name="accion" value="guardar" variant="outlined" startIcon={<Save />} disabled={pendiente}>
              Guardar y seguir después
            </Button>
            <Button onClick={previsualizar} startIcon={<Visibility />} disabled={pendiente}>
              Previsualizar el PDF
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              Al terminar se numera, se genera el PDF y se envía al cliente.
            </Typography>
          </Stack>
        </Stack>
      </Card>

      {/* El diálogo se dibuja fuera del formulario (en un portal): su botón lo envía con el atributo `form`. */}
      <Dialog open={confirmando} onClose={() => setConfirmando(false)} aria-labelledby="confirmar" maxWidth="xs" fullWidth>
        <DialogTitle id="confirmar">¿Cerrar y enviar este presupuesto?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {inicial.cliente.correo ? `Se enviará el PDF a ${inicial.cliente.correo}` : "El cliente no tiene correo: se cerrará sin enviarlo"} y ya no podrás editarlo.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmando(false)}>Volver a editar</Button>
          <Button type="submit" form="form-presupuesto" name="accion" value="terminar" variant="contained" disabled={pendiente}>
            Sí, terminar y enviar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lo que no cabe en la barra fija: en el teléfono, guardar y previsualizar; en tablet, solo previsualizar. */}
      <Stack spacing={1.5} sx={{ gridArea: "extra", display: { xs: "flex", md: "none" }, alignItems: { sm: "flex-start" } }}>
        <Button type="submit" name="accion" value="guardar" variant="outlined" startIcon={<Save />} disabled={pendiente} sx={{ display: { sm: "none" } }}>
          Guardar y seguir después
        </Button>
        <Button onClick={previsualizar} variant="outlined" startIcon={<Visibility />} disabled={pendiente}>
          Previsualizar el PDF
        </Button>
      </Stack>

      {/* Barra fija (hasta pantallas anchas): el total y las acciones siempre a la vista. Va de borde a borde de la página. */}
      <Paper
        square
        elevation={8}
        sx={{
          gridArea: "barra",
          display: { xs: "flex", lg: "none" },
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          mx: { xs: -2, sm: -3 },
          px: { xs: 2, sm: 3 },
          pt: 1.5,
          pb: "max(12px, env(safe-area-inset-bottom))",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box aria-hidden={resumenVisible} sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2, fontVariantNumeric: "tabular-nums", opacity: resumenVisible ? 0 : 1, transition: "opacity 150ms", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
          <Typography variant="h6" component="span" color={descuentoExcesivo ? "error" : "textPrimary"} sx={{ fontWeight: 700 }}>
            {clp(totales.total)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Button onClick={previsualizar} startIcon={<Visibility />} disabled={pendiente} sx={{ display: { xs: "none", md: "inline-flex" }, whiteSpace: "nowrap" }}>
            Previsualizar
          </Button>
          <Button type="submit" name="accion" value="guardar" variant="outlined" startIcon={<Save />} disabled={pendiente} sx={{ display: { xs: "none", sm: "inline-flex" }, whiteSpace: "nowrap" }}>
            Guardar y seguir después
          </Button>
          <Button variant="contained" startIcon={<Send />} loading={pendiente} loadingPosition="start" onClick={intentarTerminar} sx={{ whiteSpace: "nowrap" }}>
            {pendiente ? "Procesando…" : "Terminar y enviar"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
