import { createHash, randomInt } from 'node:crypto';

export function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashResetCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
