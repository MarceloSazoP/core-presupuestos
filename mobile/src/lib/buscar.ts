// Buscar un presupuesto por cliente, número, código o trabajo, sin importar tildes ni mayúsculas («jose» encuentra a «José»).
// Con varias palabras, cada una debe aparecer en alguna parte («juan enchufe»).
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function coincide(q: { customer: { name: string }; number: string | null; code_id?: string; service_description: string }, texto: string) {
  const palabras = plano(texto).split(/\s+/).filter(Boolean);
  const donde = plano(`${q.customer.name} ${q.number ?? ''} ${q.code_id ?? ''} ${q.service_description}`);
  return palabras.every((p) => donde.includes(p));
}
