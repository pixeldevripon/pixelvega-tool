import { randomBytes } from 'node:crypto';

import { PASSWORD_MIN_LENGTH } from '@/common/constants/password-policy';

/**
 * One pool per rule in `PASSWORD_RULES`, so the generator can guarantee the
 * policy rather than hope for it.
 *
 * `0`, `O`, `1`, `l` and `I` are absent throughout. Nobody reads this value, so
 * the exclusion is not about transcription: it is so that a password appearing
 * in a log or a support screenshot cannot be misread and chased.
 */
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIALS = '!@#$%';
const CHARSET = UPPERCASE + LOWERCASE + DIGITS + SPECIALS;

/** A uniformly random character, without the modulo bias of `bytes[i] % len`. */
function pick(pool: string): string {
  // Rejection sampling. `% pool.length` favours the first
  // `256 % pool.length` characters, which is a small bias here and a free one
  // to remove.
  const limit = 256 - (256 % pool.length);
  for (;;) {
    const [byte] = randomBytes(1);
    if (byte < limit) return pool[byte % pool.length];
  }
}

/** Fisher-Yates, so the guaranteed characters do not sit in a fixed order. */
function shuffle(characters: string[]): string[] {
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters;
}

/**
 * A password nobody is ever told.
 *
 * better-auth requires a password to create a credential account, and every
 * account here is created server side by an invite. The invited person receives
 * a set-password LINK, not this value, so it exists only to satisfy sign-up and
 * to make the account unusable until that link is followed.
 *
 * It is NOT a temporary password. An earlier version emailed it, which put a
 * working credential in an inbox, in plain text, with no expiry: forwarded mail,
 * a shared inbox, or a mailbox breach months later all became account access.
 * The link expires in an hour and can only be used once.
 *
 * ── Why one character of each class is seeded rather than left to chance ──
 *
 * The same policy that gates a human's password gates `/sign-up/email`, and the
 * invite flow goes through exactly that endpoint. At 32 characters a missing
 * class is vanishingly unlikely, but "vanishingly unlikely" here means an invite
 * that fails for one new hire and nobody else, which is the worst kind of bug to
 * be handed. Seeding makes it impossible instead of improbable.
 */
export function generateUnusedPassword(length = 32): string {
  const required = [
    pick(UPPERCASE),
    pick(LOWERCASE),
    pick(DIGITS),
    pick(SPECIALS),
  ];
  // Never shorter than the policy demands, whatever a caller passes.
  const total = Math.max(length, PASSWORD_MIN_LENGTH);
  const filler = Array.from({ length: total - required.length }, () =>
    pick(CHARSET),
  );
  return shuffle([...required, ...filler]).join('');
}
