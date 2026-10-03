import { randomInt } from 'node:crypto';
import argon2 from 'argon2';

// Código del presupuesto `AAAAAA-BBBBBBBBBB` (Contrato BD §6, regla 3): alfabeto Crockford base32 (sin I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const pick = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const newShortId = () => pick(6);
export const newSecret = () => pick(10);
export const formatCode = (shortId: string, secret: string) => `${shortId}-${secret}`;

// Tolera lo que se equivoca al teclear o leer: minúsculas, espacios, guiones, I/L por 1 y O por 0 (Crockford).
// Devuelve null si, aun así, no tiene la forma de un código.
export function parseCode(input: string): { shortId: string; secret: string } | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(s) ? { shortId: s.slice(0, 6), secret: s.slice(6) } : null;
}

export const hashSecret = (secret: string) => argon2.hash(secret, { type: argon2.argon2id });

export async function verifySecret(hash: string, secret: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, secret);
  } catch {
    return false;
  }
}

// Hash señuelo: se verifica contra él cuando el ID no existe, para que tarde lo mismo y no delate qué IDs existen.
let decoy: Promise<string> | undefined;
export const decoyHash = () => (decoy ??= hashSecret(newSecret()));
