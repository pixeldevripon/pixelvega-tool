/**
 * What makes a password acceptable, stated once.
 *
 * ── Why the rules carry their own wording and their own pattern ──
 *
 * The account screen shows a live checklist while someone types, and a checklist
 * can only be honest if the browser is checking the SAME rules the server will
 * enforce. Two ways to arrange that: restate the rules in the client, or serve
 * them. Restating them is how a checklist ends up promising "at least 12
 * characters" against a server that accepts 8, which is what this file replaced.
 *
 * So each rule ships as `{ key, label, pattern }`. The server enforces it with
 * the same `pattern`; the client compiles it for keystroke feedback and nothing
 * else. The wording is the server's too, because a rule and its explanation
 * disagreeing is the same defect one level down.
 *
 * The patterns are deliberately trivial and anchored to nothing. A pattern that
 * can backtrack is a denial of service on an unauthenticated route, and every
 * one of these is a single character class.
 */

/**
 * Twelve, not eight.
 *
 * Eight was better-auth's default and had no complexity requirement beside it,
 * which is a weaker password than a passphrase of the same length. Twelve with
 * four character classes is the NIST-era floor for a credential that protects
 * an internal system holding client work and credentials.
 *
 * `generateUnusedPassword()` produces 32 characters covering every class, so
 * raising this does not affect the invite flow or first boot.
 */
export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordRule {
  /** Stable and machine readable. The only field a client may branch on. */
  key: string;
  /** Advisory English, shown next to the tick. */
  label: string;
  /** A JavaScript regular expression source, compiled with no flags. */
  pattern: string;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    key: 'MIN_LENGTH',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    pattern: `.{${PASSWORD_MIN_LENGTH},}`,
  },
  {
    key: 'LOWERCASE',
    label: 'At least 1 lowercase letter',
    pattern: '[a-z]',
  },
  {
    key: 'UPPERCASE',
    label: 'At least 1 uppercase letter',
    pattern: '[A-Z]',
  },
  {
    key: 'NUMBER',
    label: 'At least 1 number',
    pattern: '[0-9]',
  },
  {
    key: 'SPECIAL',
    label: 'At least 1 special character',
    pattern: '[^A-Za-z0-9]',
  },
];

/**
 * Compiled once at module load rather than per call.
 *
 * `new RegExp` on every password check would recompile five patterns on a route
 * that is already rate limited precisely because it is expensive.
 */
const COMPILED = PASSWORD_RULES.map((rule) => ({
  rule,
  regex: new RegExp(rule.pattern),
}));

/** Every rule the password fails, in the order they are shown. */
export function failedPasswordRules(password: string): PasswordRule[] {
  return COMPILED.filter(({ regex }) => !regex.test(password)).map(
    ({ rule }) => rule,
  );
}

/**
 * One sentence naming what is missing, or null when the password passes.
 *
 * Returns the message rather than throwing, because the two callers throw
 * different exception types: a Nest `BadRequestException` in a DTO context and
 * better-auth's `APIError` inside its own middleware, where a Nest exception
 * would escape the auth handler unmapped.
 *
 * The message lists every failure at once. Reporting them one at a time turns a
 * single mistake into five round trips, and this route is rate limited.
 */
export function describePasswordPolicyFailure(password: string): string | null {
  const failed = failedPasswordRules(password);
  if (failed.length === 0) return null;
  return `That password is not strong enough. It needs: ${failed
    .map((rule) => rule.label.toLowerCase())
    .join(', ')}.`;
}
