"use client";

import { Icono } from "./iconos";
import { marcarEnviadoAction } from "../actions";

// Abre WhatsApp con el mensaje y, al pulsar, avisa a la API que el presupuesto se envió por ese canal.
export function EnlaceWhatsApp({ href, className }: { href: string; className: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={() => void marcarEnviadoAction("WHATSAPP")}>
      <Icono n="chat" />
      Enviar por WhatsApp
    </a>
  );
}
