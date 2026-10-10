"use client";

import EditOutlined from "@mui/icons-material/EditOutlined";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, useTransition } from "react";
import { bandera, paisDe, PAISES, PAISES_ORDENADOS, paisDelTelefono, separarTelefono } from "@/lib/paises";
import { formatearTelefono, plantillaTelefono } from "@/lib/telefono";
import { corregirClienteAction } from "../actions";

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

// Teléfono y correo del cliente, siempre corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después, incluso con el presupuesto terminado. No lleva <form> propio: se usa dentro del formulario del editor.
export function ContactoCliente({ nombre, telefono, correo, prefijo }: { nombre?: string; telefono: string; correo: string | null; prefijo?: string }) {
  const [editando, setEditando] = useState(false);
  const [nom, setNom] = useState(nombre ?? "");
  // El país del número. La lista guarda el país y no el prefijo, porque el +1 es de dos países (República Dominicana y Puerto Rico).
  const paisInicial = () => paisDelTelefono(telefono)?.country ?? PAISES.find((p) => p.calling_code === (prefijo ?? "+56"))?.country ?? "CL";
  const [pais, setPais] = useState(paisInicial);
  const cod = paisDe(pais).calling_code;
  const [tel, setTel] = useState(() => separarTelefono(telefono, prefijo ?? "+56").nacional);
  const [mail, setMail] = useState(correo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();

  const guardar = () =>
    empezar(async () => {
      setError(null);
      const r = await corregirClienteAction(tel, mail, nombre === undefined ? undefined : nom, cod);
      if (r.error) return setError(r.error);
      setEditando(false);
    });

  if (!editando) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {nombre !== undefined ? <Avatar aria-hidden="true">{iniciales(nombre)}</Avatar> : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {nombre !== undefined ? <Typography sx={{ fontWeight: 500 }}>{nombre}</Typography> : null}
          <Typography variant="body2" color="text.secondary">
            {telefono}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {correo ?? "Sin correo"}
          </Typography>
        </Box>
        <IconButton
          onClick={() => {
            setNom(nombre ?? "");
            const sep = separarTelefono(telefono, prefijo ?? "+56");
            setTel(sep.nacional);
            setPais(paisInicial());
            setMail(correo ?? "");
            setError(null);
            setEditando(true);
          }}
          aria-label="Corregir los datos del cliente"
          title="Corregir los datos del cliente"
          sx={{ alignSelf: "flex-start" }}
        >
          <EditOutlined />
        </IconButton>
      </Box>
    );
  }
  return (
    <Stack spacing={2.5} role="group" aria-label="Corregir los datos del cliente" sx={{ pt: 1 }}>
      {nombre !== undefined ? <TextField label="Nombre del cliente" autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} /> : null}
      <Box sx={{ display: "flex", gap: 1 }}>
        {/* El código de país: Chile primero y luego todos por nombre. */}
        <TextField
          select
          label="País"
          value={pais}
          onChange={(e) => {
            setPais(e.target.value);
            setTel(formatearTelefono(tel, paisDe(e.target.value).calling_code)); // lo ya escrito toma el formato del nuevo país
          }}
          slotProps={{ select: { native: true } }}
          sx={{ width: "auto", flexShrink: 0, maxWidth: "45%" }}
        >
          {PAISES_ORDENADOS.map((p) => (
            <option key={p.country} value={p.country}>
              {bandera(p.country)} {p.name} {p.calling_code}
            </option>
          ))}
        </TextField>
        <TextField
          label="Teléfono del cliente"
          type="tel"
          autoComplete="off"
          value={formatearTelefono(tel, cod)}
          onChange={(e) => setTel(formatearTelefono(e.target.value, cod))}
          placeholder={plantillaTelefono(cod)}
          slotProps={{ htmlInput: { inputMode: "tel", maxLength: 24 } }}
          sx={{ minWidth: 0 }}
        />
      </Box>
      <TextField
        label="Correo del cliente"
        type="email"
        autoComplete="off"
        value={mail}
        onChange={(e) => setMail(e.target.value)}
        placeholder="Déjalo vacío si no tiene"
        slotProps={{ htmlInput: { inputMode: "email", autoCapitalize: "none" } }}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" loading={enCurso} onClick={guardar}>
          Guardar
        </Button>
        <Button disabled={enCurso} onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </Stack>
    </Stack>
  );
}
