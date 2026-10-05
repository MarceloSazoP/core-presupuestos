import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esCorreo, formatearTelefono, normalizarTelefono } from './telefono.ts';

test('el teléfono se lleva a E.164; sin prefijo se asume Chile', () => {
  assert.equal(normalizarTelefono('9 5482 2089'), '+56954822089');
  assert.equal(normalizarTelefono('954822089'), '+56954822089');
  assert.equal(normalizarTelefono('+56 9 5482 2089'), '+56954822089');
  assert.equal(normalizarTelefono('56954822089'), '+56954822089');
  assert.equal(normalizarTelefono('+1 (415) 555-2671'), '+14155552671');
  for (const malo of ['', 'abc', '12345', '+0123456789', '+56', '8 1234 5678 9']) assert.equal(normalizarTelefono(malo), null, malo);
});

test('sin prefijo se antepone el del país del usuario, y uno escrito se respeta', () => {
  assert.equal(normalizarTelefono('987 654 321', '+51'), '+51987654321');
  assert.equal(normalizarTelefono('55 1234 5678', '+52'), '+525512345678');
  assert.equal(normalizarTelefono('51987654321', '+51'), '+51987654321', 'el prefijo escrito sin «+»');
  assert.equal(normalizarTelefono('+56 9 5482 2089', '+51'), '+56954822089', 'con «+» no se toca: es de otro país');
  for (const malo of ['', 'abc', '123', '1234567890123456']) assert.equal(normalizarTelefono(malo, '+51'), null, malo);
});

test('el correo necesita arroba y dominio', () => {
  assert.ok(esCorreo(' ana@mail.cl '));
  for (const malo of ['', 'ana', 'ana@', '@mail.cl', 'ana@mail', 'a na@mail.cl']) assert.equal(esCorreo(malo), false, malo);
});

test('el teléfono se ve con el formato de su país mientras se escribe', () => {
  assert.equal(formatearTelefono('954822089', '+56'), '9 5482 2089');
  assert.equal(formatearTelefono('9548', '+56'), '9 548', 'a medio escribir');
  assert.equal(formatearTelefono('987654321', '+51'), '987 654 321');
  assert.equal(formatearTelefono('12345678', '+51'), '12 345 678', 'fijo de Perú');
  assert.equal(formatearTelefono('5512345678', '+52'), '55 1234 5678');
  assert.equal(formatearTelefono('91112345678', '+54'), '9 11 1234 5678');
  assert.equal(formatearTelefono('94123456', '+598'), '94 123 456');
  assert.equal(formatearTelefono('991234567', '+593'), '99 123 4567');
  assert.equal(formatearTelefono('71234567', '+591'), '71234567');
  assert.equal(formatearTelefono('88881234', '+506'), '8888 1234');
  assert.equal(formatearTelefono('612345678', '+34'), '612 345 678');
  assert.equal(formatearTelefono('911234567', '+34'), '91 123 45 67', 'fijo de España');
  assert.equal(formatearTelefono('+56 9 5482 2089', '+51'), '+56 9 5482 2089', 'con «+» no se toca');
  assert.equal(formatearTelefono('95 48-22 089', '+56'), '9 5482 2089', 'se ignoran espacios y guiones al escribir');
  assert.equal(formatearTelefono('', '+56'), '');
});
