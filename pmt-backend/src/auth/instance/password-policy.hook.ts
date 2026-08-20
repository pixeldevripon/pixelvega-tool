import { APIError } from 'better-auth/api';

import { describePasswordPolicyFailure } from '@/common/constants/password-policy';

/**
 * Every better-auth path that sets a password.
 *
 * A rule enforced on two of the three is not enforced. `/sign-up/email` is the
 * invite flow (and first boot), `/reset-password` is the emailed link, and
 * `/change-password` is the account screen.
 */
export const PASSWORD_WRITE_PATHS = new Set([
  '/sign-up/email',
  '/reset-password',
  '/change-password',
]);

/**
 * Where the new password lives in each path's body.
 *
 * `/sign-up/email` calls it `password`; the other two call it `newPassword`.
 * Getting this wrong does not fail loudly: the field reads as undefined, the
 * check is skipped, and the policy silently stops applying to that route.
 */
function passwordField(path: string): string {
  return path === '/sign-up/email' ? 'password' : 'newPassword';
}

/**
 * Refuses a password that does not meet `PASSWORD_RULES`.
 *
 * ── Why this exists beside `minPasswordLength` ──
 *
 * better-auth checks a length and nothing else, so twelve repetitions of one
 * letter was acceptable. The account screen shows a checklist of five
 * requirements, and a checklist that does not describe a real gate is worse than
 * no checklist: it teaches people the rules are stricter than they are.
 *
 * ── Why it is its own module rather than a closure in auth.instance.ts ──
 *
 * The instance builds a better-auth object and a PrismaClient the moment it is
 * imported, so nothing in that file can be tested without booting both. This is
 * a pure function over a request body. It is still evaluated at module load and
 * still uses no DI, which is the property `auth.instance.ts` actually needs.
 *
 * The body is untyped on purpose: better-auth validates the shape AFTER
 * `hooks.before` runs, so a non-string in the password field is not this
 * function's error to report. It defers, and better-auth answers.
 */
export function assertPasswordMeetsPolicy(ctx: {
  path: string;
  body?: unknown;
}): void {
  const body = ctx.body as Record<string, unknown> | undefined;
  const candidate = body?.[passwordField(ctx.path)];
  if (typeof candidate !== 'string') {
    return;
  }

  const failure = describePasswordPolicyFailure(candidate);
  if (failure) {
    // better-auth's own error type, not a Nest exception: these hooks run
    // inside better-auth's handler, which is mounted as middleware and never
    // reaches Nest's exception filter. A `BadRequestException` thrown here
    // escapes unmapped and surfaces as a 500.
    throw new APIError('BAD_REQUEST', {
      message: failure,
      code: 'PASSWORD_TOO_WEAK',
    });
  }
}
