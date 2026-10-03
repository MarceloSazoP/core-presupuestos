// El MVP no usa la API de WhatsApp Business: se abre WhatsApp con el mensaje escrito (CLAUDE.md §15).
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
}

// `enlace` es la vista pública del presupuesto (/q/[token]): el cliente la abre sin instalar nada y descarga el PDF.
export function mensajePresupuesto(d: { nombre: string; numero: string; total: string; descripcion: string; enlace: string }): string {
  return `Hola ${d.nombre}, te envié el presupuesto ${d.numero} por ${d.total} (${d.descripcion}). Puedes verlo y descargar el PDF aquí: ${d.enlace}`;
}
