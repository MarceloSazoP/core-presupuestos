import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correoCodigo } from '../src/lib/deliver';
import { correoPresupuesto } from '../src/lib/correo-presupuesto';

test('los correos corporativos escapan lo que escribe la gente y traen su contenido clave', () => {
  const html = correoPresupuesto(
    { number: 'CP-2026-0001', finalized_at: '', valid_until: '2026-10-31', professional: { name: 'Ana <b>', phone: '+56 9 1', email: 'a@a.cl', logo_file_id: null, signature_file_id: null }, customer: { name: 'Juan' }, service_description: 'Techo & pintura', service_address: null, items: [], subtotal: 0, discount: 0, total: 119000, warranty: { kind: 'NONE', text: '' }, validity_days: 15, observations: null, include_signature: false, include_qr: false },
    'https://x.cl/q/t',
    '<script>alert(1)</script>',
  );
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'), 'el mensaje se escapa');
  assert.ok(html.includes('Ana &lt;b&gt;') && html.includes('Techo &amp; pintura'), 'los datos se escapan');
  assert.ok(html.includes('31-10-2026') && html.includes('https://x.cl/q/t'), 'vigencia en DD-MM-YYYY y enlace');
  assert.ok(correoCodigo('482913').includes('482913'), 'el código de ingreso va en el correo');
});
