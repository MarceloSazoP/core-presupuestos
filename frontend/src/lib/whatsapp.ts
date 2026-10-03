// El MVP no usa la API de WhatsApp Business: se abre WhatsApp con el mensaje escrito (CLAUDE.md §15).
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
}
