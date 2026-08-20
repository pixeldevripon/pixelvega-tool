/**
 * The password-sensitive rate limit, and specifically its FALLBACK behaviour.
 *
 * The value itself is not the interesting part. What is worth pinning is that a
 * bad environment value cannot silently turn the limit off. `Number('')` is 0
 * and `Number('abc')` is NaN, and better-auth treats a non-positive or NaN max
 * as no limit at all, so a typo in a `.env` would remove the only defence
 * against password guessing on `/sign-in/email` and say nothing about it.
 *
 * `env.validate.ts` declares the variable as a positive integer and would reject
 * most of these at boot. This spec covers the case where it does not run, or
 * where a value reaches the module by another route: the module has to be safe
 * on its own, because it is what better-auth actually reads.
 *
 * The module is re-imported per case because the constant is resolved once, at
 * module load, from `process.env`.
 */

const ENV_KEY = 'AUTH_SENSITIVE_RATE_LIMIT_MAX';
const DEFAULT_MAX = 5;

/**
 * The constant is resolved once, at module load, from `process.env`, so each
 * case has to re-import the module with a different value set.
 *
 * It lives in its own file precisely so this is possible: reading it out of
 * `auth.instance.ts` would build a better-auth instance and a PrismaClient as a
 * side effect of the import.
 */
function loadConstant(value: string | undefined): number {
  jest.resetModules();

  if (value === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/auth/instance/rate-limit.config') as {
    SENSITIVE_AUTH_MAX_PER_MINUTE: number;
  };
  return mod.SENSITIVE_AUTH_MAX_PER_MINUTE;
}

describe('SENSITIVE_AUTH_MAX_PER_MINUTE', () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
    jest.resetModules();
  });

  it('defaults to 5 when the variable is unset', () => {
    // The production value. Unset must never mean "unlimited": a deployment
    // that forgets the variable has to be protected, not open.
    expect(loadConstant(undefined)).toBe(DEFAULT_MAX);
  });

  it('uses an explicitly set positive integer', () => {
    expect(loadConstant('50')).toBe(50);
  });

  it('accepts a value of 1, the tightest usable limit', () => {
    expect(loadConstant('1')).toBe(1);
  });

  it.each([
    ['an empty string', ''],
    ['a non-numeric value', 'lots'],
    ['zero, which better-auth reads as no limit', '0'],
    ['a negative value', '-10'],
    ['a decimal, which is not a whole number of attempts', '5.5'],
    ['whitespace', '   '],
  ])('falls back to the default for %s', (_label, value) => {
    // Every one of these would otherwise reach better-auth as 0 or NaN and
    // remove the limit entirely.
    expect(loadConstant(value)).toBe(DEFAULT_MAX);
  });
});
