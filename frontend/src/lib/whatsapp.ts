// El MVP no usa la API de WhatsApp Business: se abre WhatsApp con el mensaje escrito (CLAUDE.md §15).
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
}

export function mensajePresupuesto(d: {
  nombre: string;
  numero: string;
  total: string;
  descripcion: string;
  porCorreo: boolean;
}): string {
  return (
    `Hola ${d.nombre}, te envié el presupuesto ${d.numero} por ${d.total} (${d.descripcion}).` +
    (d.porCorreo ? ' El PDF va adjunto en tu correo.' : '')
  );
}
