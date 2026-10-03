import { open } from 'node:fs/promises';

export type Detected = { mime: string; ext: string };

// Tipo por *magic bytes*, nunca por el Content-Type ni el nombre que envía el cliente (Arquitectura A9).
export function detect(head: Buffer): Detected | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (head.length >= 8 && head.subarray(4, 8).toString('latin1') === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (head.length >= 3 && head.subarray(0, 3).toString('latin1') === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (head.length >= 2 && head[0] === 0xff && (head[1]! & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

export const IMAGES = ['image/jpeg', 'image/png'];
export const AUDIO = ['audio/mp4', 'audio/mpeg'];

export async function detectFile(path: string): Promise<Detected | null> {
  const f = await open(path, 'r');
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await f.read(buf, 0, 16, 0);
    return detect(buf.subarray(0, bytesRead));
  } finally {
    await f.close();
  }
}
