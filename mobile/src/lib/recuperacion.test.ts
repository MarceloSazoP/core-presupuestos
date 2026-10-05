import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokenDeRecuperacion } from './recuperacion.ts';

const T = 'a'.repeat(20) + 'B'.repeat(20) + '_-9';

test('se acepta el QR completo o el código solo; cualquier otra cosa se rechaza', () => {
  assert.equal(tokenDeRecuperacion(`corepresupuesto://recuperar/${T}`), T);
  assert.equal(tokenDeRecuperacion(`  ${T}  `), T, 'el código pegado, con espacios');
  assert.equal(tokenDeRecuperacion(`${T.slice(0, 20)}\n${T.slice(20)}`), T, 'partido en dos líneas');
  for (const malo of ['', 'corto', `corepresupuesto://web/${T}`, `https://otro.sitio/${T}`, `${T}x`, `${T.slice(0, 42)}!`]) assert.equal(tokenDeRecuperacion(malo), null, malo);
});
