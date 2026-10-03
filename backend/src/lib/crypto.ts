import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomCode6 = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

// HMAC con pepper del servidor, atado al desafío: el mismo código en otro desafío da otro hash.
export const hashCode = (challengeId: string, code: string) =>
  createHmac('sha256', config.AUTH_CODE_PEPPER).update(`${challengeId}:${code}`).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
