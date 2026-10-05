import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dinero, montoEscrito, paisDe, PAISES } from './paises.ts';
import { totalesDe } from './totales.ts';

test('el monto lleva el símbolo y el separador de su moneda', () => {
  assert.equal(dinero(1234567), '$1.234.567');
  assert.equal(dinero(1234567, 'PEN'), 'S/ 1,234,567');
  assert.equal(dinero(1234567, 'MXN'), '$1,234,567');
  assert.equal(dinero(1234567, 'USD'), '$1,234,567');
  assert.equal(dinero(1234567, 'CRC'), '₡1 234 567');
  assert.equal(dinero(1234567, 'EUR'), '1.234.567 €');
  assert.equal(dinero(-5000), '-$5.000');
  assert.equal(dinero(100, 'XXX'), '$100');
  assert.equal(montoEscrito('12500', 'PEN'), 'S/ 12,500');
  assert.equal(montoEscrito(''), '');
});

test('el país desconocido cae en Chile y el impuesto usa la tasa del presupuesto', () => {
  assert.equal(paisDe('ZZ').country, 'CL');
  assert.equal(paisDe(null).country, 'CL');
  assert.equal(PAISES.length, 13);
  assert.deepEqual(totalesDe(100000, 0, true, 16), { iva: 16000, total: 116000 });
  assert.deepEqual(totalesDe(100000, 0, true), { iva: 19000, total: 119000 });
});

test('un teléfono guardado se parte en el prefijo de su país y el número; uno de otro país queda entero', async () => {
  const { separarTelefono } = await import('./paises.ts');
  assert.deepEqual(separarTelefono('+51987654321', '+56'), { codigo: '+51', nacional: '987654321' });
  assert.deepEqual(separarTelefono('+59899123456', '+56'), { codigo: '+598', nacional: '99123456' });
  assert.deepEqual(separarTelefono('+4930123456', '+56'), { codigo: '+56', nacional: '+4930123456' }, 'de un país que no está en la lista: se deja como se escribió');
  assert.deepEqual(separarTelefono('954822089', '+51'), { codigo: '+51', nacional: '954822089' });
});

test('la bandera sale del código del país; las listas van con Chile primero y luego todos por nombre', async () => {
  const { bandera, PAISES_ORDENADOS } = await import('./paises.ts');
  assert.equal(bandera('CL'), '\u{1F1E8}\u{1F1F1}');
  assert.equal(bandera('pe'), '\u{1F1F5}\u{1F1EA}');
  assert.equal(PAISES_ORDENADOS[0]!.country, 'CL');
  const resto = PAISES_ORDENADOS.slice(1).map((p) => p.name);
  assert.deepEqual(resto, [...resto].sort((a, b) => a.localeCompare(b, 'es')));
  assert.equal(PAISES_ORDENADOS.length, 13);
});
