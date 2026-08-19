import { randomBytes } from 'node:crypto';

const CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += CHARSET[bytes[i] % CHARSET.length];
  }
  return password;
}
