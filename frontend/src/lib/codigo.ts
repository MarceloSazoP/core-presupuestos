import argon2 from 'argon2';

export const normalizarCodigo = (codigo: string) => codigo.trim().toLowerCase();

export function hashCodigo(codigo: string): Promise<string> {
  return argon2.hash(normalizarCodigo(codigo), { type: argon2.argon2id });
}

export async function verificarCodigo(hash: string, codigo: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, normalizarCodigo(codigo));
  } catch {
    return false;
  }
}
