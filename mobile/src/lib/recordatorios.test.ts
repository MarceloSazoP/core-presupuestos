import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fechaDelAviso, MAX_AVISOS, planificar, vencidos } from './recordatorios.ts';

const q = (id: string, status: string, dia: string | null) => ({ id, number: `CP-${id}`, customer: { name: `Cliente ${id}` }, commercial_status: status, next_contact_date: dia });
const ahora = new Date(2026, 9, 4, 12, 0); // 4 oct 2026, mediodía

test('solo se avisa de lo enviado o en seguimiento, con fecha futura', () => {
  const r = planificar([q('a', 'SENT', '2026-10-07'), q('b', 'FOLLOW_UP', '2026-10-05'), q('c', 'ACCEPTED', '2026-10-07'), q('d', 'REJECTED', '2026-10-07'), q('e', 'NONE', '2026-10-07'), q('f', 'SENT', null), q('g', 'SENT', '2026-10-03')], [], ahora);
  assert.deepEqual(r.programar.map((a) => a.quoteId), ['b', 'a']); // ordenados por fecha
  assert.equal(r.programar[0]!.identifier, 'contacto-b');
});

test('el aviso sale a las 9:00 del día, y el de hoy después de las 9 ya no se programa', () => {
  assert.equal(fechaDelAviso('2026-10-07').getHours(), 9);
  assert.equal(planificar([q('x', 'SENT', '2026-10-04')], [], ahora).programar.length, 0);
  assert.equal(planificar([q('x', 'SENT', '2026-10-04')], [], new Date(2026, 9, 4, 8, 0)).programar.length, 1);
});

test('se cancelan los avisos que ya no corresponden, pero no los ajenos', () => {
  const r = planificar([q('a', 'SENT', '2026-10-07')], ['contacto-a', 'contacto-vieja', 'otra-cosa'], ahora);
  assert.deepEqual(r.cancelar, ['contacto-vieja']);
});

test('nunca se programan más de los que admite iOS, y quedan los más próximos', () => {
  const muchos = Array.from({ length: 100 }, (_, i) => q(String(i), 'SENT', `2027-01-${String((i % 28) + 1).padStart(2, '0')}`));
  const r = planificar(muchos, [], ahora);
  assert.equal(r.programar.length, MAX_AVISOS);
  assert.ok(r.programar.every((a, i, l) => i === 0 || l[i - 1]!.fecha <= a.fecha));
});

test('a la bandeja de la app entran los avisos que ya debieron sonar, con el mismo id que la notificación del teléfono', () => {
  const lista = [q('a', 'SENT', '2026-10-03'), q('b', 'FOLLOW_UP', '2026-10-04'), q('c', 'SENT', '2026-10-05'), q('d', 'ACCEPTED', '2026-10-03'), q('e', 'SENT', null)];
  const r = vencidos(lista, ahora); // 4 oct, mediodía: el de hoy a las 09:00 ya sonó; el de mañana no
  assert.deepEqual(r.map((a) => a.id), ['contacto-a@2026-10-03', 'contacto-b@2026-10-04']);
  assert.equal(r[0]!.quoteId, 'a');
  assert.equal(r[0]!.leido, false);
  assert.equal(vencidos(lista, new Date(2026, 9, 4, 8, 0)).length, 1, 'antes de las 09:00 el de hoy todavía no suena');
});
