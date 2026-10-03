import crypto from 'crypto';

export const generateAccessKey = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

export const generatePublicAccessKey = (): string => {
  // Formato: XXXXXXXXXXXXXXXXXXXX (32 caracteres)
  return generateAccessKey(32);
};

export const generateEditAccessKey = (): string => {
  // Formato: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (64 caracteres)
  return generateAccessKey(64);
};

export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
