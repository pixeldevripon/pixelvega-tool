import { randomBytes } from 'node:crypto';

const CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

/**
 * A password nobody is ever told.
 *
 * better-auth requires a password to create a credential account, and every
 * account here is created server side by an invite. The invited person receives
 * a set-password LINK, not this value, so it exists only to satisfy sign-up and
 * to make the account unusable until that link is followed.
 *
 * It is NOT a temporary password. An earlier version emailed it, which put a
 * working credential in an inbox, in plain text, with no expiry: forwarded
 * mail, a shared inbox, or a mailbox breach months later all became account
 * access. The link expires in an hour and can only be used once.
 */
export function generateUnusedPassword(length = 32): string {
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += CHARSET[bytes[i] % CHARSET.length];
  }
  return password;
}
