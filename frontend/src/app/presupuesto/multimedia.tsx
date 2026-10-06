"use client";

import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import OpenInNew from "@mui/icons-material/OpenInNew";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useState, useTransition, type KeyboardEvent } from "react";
import { eliminarArchivoAction } from "../actions";

// Fotos y notas de voz de la visita. Son internas: no salen en el PDF ni en la vista pública. Mientras el presupuesto se
// puede editar (`editable`) cada una se puede eliminar, con una confirmación.
type Props = { fotos: string[]; audios: { id: string; segundos: number }[]; editable?: boolean };
type Objetivo = { tipo: "foto" | "audio"; id: string };

const MAX_FOTOS = 30; // igual que el servidor (MAX_PHOTOS) y la app
const VISIBLES = 9; // casillas del panel; con más fotos la novena dice «+N» y abre la galería
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const archivo = (id: string, mini = false) => `/presupuesto/archivo/${id}${mini ? "?mini=1" : ""}`;

export function Multimedia({ fotos, audios, editable = false }: Props) {
  const [confirmando, setConfirmando] = useState<Objetivo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();
  const [abierta, setAbierta] = useState<number | null>(null); // foto abierta en la galería

  const eliminar = ({ tipo, id }: Objetivo) =>
    empezar(async () => {
      setError(null);
      const r = await eliminarArchivoAction(tipo, id);
      if (r.error) setError(r.error);
      setConfirmando(null);
      if (tipo === "foto" && abierta !== null) setAbierta(fotos.length <= 1 ? null : Math.min(abierta, fotos.length - 2));
    });
  const es = (tipo: Objetivo["tipo"], id: string) => confirmando?.tipo === tipo && confirmando.id === id;

  if (fotos.length === 0 && audios.length === 0) return null;
  const conMas = fotos.length > VISIBLES;
  const casillas = conMas ? fotos.slice(0, VISIBLES - 1) : fotos;

  return (
    <Stack component="section" aria-label="Fotos y notas de voz" spacing={2.5}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      {fotos.length > 0 ? (
        <Stack spacing={1}>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="overline" component="h3" color="text.secondary">
              Fotos
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {fotos.length} de {MAX_FOTOS}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={(fotos.length / MAX_FOTOS) * 100} aria-label={`${fotos.length} de ${MAX_FOTOS} fotos`} sx={{ borderRadius: 1 }} />
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(5.25rem, 1fr))", gap: 0.5 }}>
            {casillas.map((id, i) => (
              <li key={id}>
                <ButtonBase onClick={() => setAbierta(i)} aria-label={`Ver la foto ${i + 1}`} sx={{ display: "block", width: "100%", borderRadius: 1, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF; no hay nada que optimizar */}
                  <img src={archivo(id, true)} width={480} height={480} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "auto", aspectRatio: "1", objectFit: "cover" }} />
                </ButtonBase>
              </li>
            ))}
            {conMas ? (
              <li>
                <ButtonBase onClick={() => setAbierta(VISIBLES - 1)} aria-label={`Ver las ${fotos.length} fotos`} sx={{ position: "relative", display: "block", width: "100%", borderRadius: 1, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF */}
                  <img src={archivo(fotos[VISIBLES - 1]!, true)} width={480} height={480} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "auto", aspectRatio: "1", objectFit: "cover" }} />
                  <Box component="span" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(0,0,0,0.6)", color: "common.white", typography: "h6" }}>
                    +{fotos.length - (VISIBLES - 1)}
                  </Box>
                </ButtonBase>
              </li>
            ) : null}
          </Box>
          <Button startIcon={<PhotoLibraryOutlined />} onClick={() => setAbierta(0)} sx={{ alignSelf: "flex-start", ml: -1 }}>
            {fotos.length === 1 ? "Ver la foto" : `Ver las ${fotos.length} fotos`}
          </Button>
        </Stack>
      ) : null}

      {audios.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography variant="overline" component="h3" color="text.secondary">
            Notas de voz
          </Typography>
          {audios.map((a, i) => (
            <Stack key={a.id} spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Nota de voz {i + 1} · {mmss(a.segundos)}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                <audio controls preload="none" src={archivo(a.id)} style={{ minWidth: 0, flex: 1 }} />
                {editable && !es("audio", a.id) ? (
                  <IconButton onClick={() => setConfirmando({ tipo: "audio", id: a.id })} aria-label={`Eliminar la nota de voz ${i + 1}`}>
                    <DeleteOutline />
                  </IconButton>
                ) : null}
              </Box>
              {editable && es("audio", a.id) ? (
                <Alert
                  severity="warning"
                  role="group"
                  aria-label={`Eliminar la nota de voz ${i + 1}`}
                  action={
                    <>
                      <Button color="inherit" size="small" loading={enCurso} onClick={() => eliminar({ tipo: "audio", id: a.id })}>
                        Eliminar
                      </Button>
                      <Button color="inherit" size="small" disabled={enCurso} onClick={() => setConfirmando(null)}>
                        Cancelar
                      </Button>
                    </>
                  }
                >
                  ¿Eliminar esta nota de voz?
                </Alert>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : null}

      {abierta !== null && fotos.length > 0 ? (
        <Galeria
          fotos={fotos}
          indice={Math.min(abierta, fotos.length - 1)}
          onIr={setAbierta}
          onCerrar={() => {
            setAbierta(null);
            setConfirmando(null);
          }}
          editable={editable}
          confirmando={confirmando?.tipo === "foto" ? confirmando.id : null}
          onConfirmar={(id) => setConfirmando(id ? { tipo: "foto", id } : null)}
          onEliminar={(id) => eliminar({ tipo: "foto", id })}
          enCurso={enCurso}
        />
      ) : null}
    </Stack>
  );
}

type PropsGaleria = {
  fotos: string[];
  indice: number;
  onIr: (i: number) => void;
  onCerrar: () => void;
  editable: boolean;
  confirmando: string | null;
  onConfirmar: (id: string | null) => void;
  onEliminar: (id: string) => void;
  enCurso: boolean;
};

// Todas las fotos (hasta 30): la grande con flechas (también ← y → del teclado) y la grilla para saltar a cualquiera.
function Galeria({ fotos, indice, onIr, onCerrar, editable, confirmando, onConfirmar, onEliminar, enCurso }: PropsGaleria) {
  const pantallaChica = useMediaQuery(useTheme().breakpoints.down("sm"));
  const id = fotos[indice]!;
  const ir = (paso: number) => {
    onConfirmar(null);
    onIr((indice + paso + fotos.length) % fotos.length);
  };
  const alPulsarTecla = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "ArrowLeft") ir(-1);
    if (e.key === "ArrowRight") ir(1);
  };

  return (
    <Dialog open onClose={onCerrar} fullScreen={pantallaChica} maxWidth="lg" fullWidth aria-labelledby="titulo-galeria" onKeyDown={alPulsarTecla}>
      <DialogTitle id="titulo-galeria" sx={{ display: "flex", alignItems: "center", gap: 1.5, pr: 1 }}>
        <Box component="span" sx={{ flex: 1 }}>
          Fotos de la visita
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5, fontVariantNumeric: "tabular-nums" }}>
            {fotos.length} de {MAX_FOTOS} · solo para ti
          </Typography>
        </Box>
        <IconButton onClick={onCerrar} aria-label="Cerrar">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: "flex", flexWrap: "wrap" }}>
        <Box component="figure" sx={{ m: 0, p: { xs: 2, sm: 3 }, flex: "999 1 32rem", minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5, bgcolor: "action.hover" }}>
          <Box sx={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 1, overflow: "hidden", bgcolor: "common.black" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF */}
            <img key={id} src={archivo(id)} alt={`Foto ${indice + 1} de la visita`} decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            {fotos.length > 1 ? (
              <>
                <IconButton onClick={() => ir(-1)} aria-label="Foto anterior" sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "background.paper", boxShadow: 3, "&:hover": { bgcolor: "background.paper" } }}>
                  <ChevronLeft />
                </IconButton>
                <IconButton onClick={() => ir(1)} aria-label="Foto siguiente" sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "background.paper", boxShadow: 3, "&:hover": { bgcolor: "background.paper" } }}>
                  <ChevronRight />
                </IconButton>
              </>
            ) : null}
          </Box>
          <Box component="figcaption" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              Foto {indice + 1} de {fotos.length}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button href={archivo(id)} target="_blank" rel="noopener" startIcon={<OpenInNew />} size="small">
                Original
              </Button>
              {editable ? (
                <Button color="error" size="small" startIcon={<DeleteOutline />} onClick={() => onConfirmar(id)} disabled={confirmando === id}>
                  Eliminar
                </Button>
              ) : null}
            </Stack>
          </Box>
          {editable && confirmando === id ? (
            <Alert
              severity="warning"
              action={
                <>
                  <Button color="inherit" size="small" loading={enCurso} onClick={() => onEliminar(id)}>
                    Eliminar
                  </Button>
                  <Button color="inherit" size="small" disabled={enCurso} onClick={() => onConfirmar(null)}>
                    Cancelar
                  </Button>
                </>
              }
            >
              ¿Eliminar la foto {indice + 1}? No se puede deshacer.
            </Alert>
          ) : null}
        </Box>

        <Box sx={{ flex: "1 1 18rem", minWidth: 0, p: 2, borderLeft: { md: 1 }, borderColor: { md: "divider" } }}>
          <Typography variant="overline" component="h3" color="text.secondary">
            Todas las fotos
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: "none", maxHeight: { md: "32rem" }, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))", gap: 0.5 }}>
            {fotos.map((f, i) => (
              <li key={f}>
                <ButtonBase
                  onClick={() => {
                    onConfirmar(null);
                    onIr(i);
                  }}
                  aria-label={`Ver la foto ${i + 1}`}
                  aria-current={i === indice ? "true" : undefined}
                  sx={{ display: "block", width: "100%", borderRadius: 1, overflow: "hidden", outline: i === indice ? "3px solid" : "none", outlineColor: "primary.main", outlineOffset: -3 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF */}
                  <img src={archivo(f, true)} width={240} height={240} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "auto", aspectRatio: "1", objectFit: "cover" }} />
                </ButtonBase>
              </li>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Hasta {MAX_FOTOS} fotos por presupuesto. Las fotos no salen en el PDF del cliente.
        </Typography>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
