"use client";

import WhatsApp from "@mui/icons-material/WhatsApp";
import Button from "@mui/material/Button";
import { marcarEnviadoAction } from "../actions";

// Abre WhatsApp con el mensaje y, al pulsar, avisa a la API que el presupuesto se envió por ese canal.
export function EnlaceWhatsApp({ href, variant = "contained" }: { href: string; variant?: "contained" | "outlined" }) {
  return (
    <Button href={href} target="_blank" rel="noopener noreferrer" variant={variant} size="large" startIcon={<WhatsApp />} onClick={() => void marcarEnviadoAction("WHATSAPP")}>
      Enviar por WhatsApp
    </Button>
  );
}
