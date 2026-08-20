/**
 * How hard the password-sensitive auth routes may be hammered.
 *
 * Its own module, and not part of `auth.instance.ts`, for one practical reason:
 * that file builds a better-auth instance and a `PrismaClient` at module load,
 * so importing it to read one number pulls in ESM-only packages and a database
 * adapter. A tunable should be readable, and testable, without any of that.
 */

/**
 * Attempts per minute, per IP, on the four password-sensitive auth routes:
 * sign-in, request-reset, reset, and change.
 *
 * ── Why this is a knob and not a raised number ──
 *
 * Five is right for production. It is the defence against password guessing,
 * and it is the reason `AuthController` can carry `@SkipThrottle()` and leave
 * Nest's general tiers off these routes.
 *
 * It is wrong for local development, and not because a developer is careless.
 * better-auth counts per IP, and in local development the browser, the Next
 * route guard and server-side rendering all reach the backend as 127.0.0.1, so
 * one page load can spend several of the five. Testing a sign-in flow, or
 * signing in as four roles in a row to check what each of them sees, exhausts
 * it in seconds and then the failure reads as "wrong password" rather than as
 * "throttled".
 *
 * ── Opt in by explicit value, never inferred from NODE_ENV ──
 *
 * The same lesson `AUTH_DISABLE_ORIGIN_CHECK` records a few lines below:
 * relaxing for "everything that is not exactly production" meant staging ran
 * with no protection at all. So the default is 5 whatever the environment, and
 * raising it is something a person types into a `.env` on purpose.
 *
 * ── The counters are in memory ──
 *
 * No `rateLimit` storage is configured, so better-auth keeps them in process.
 * Restarting the backend clears them, which is the quickest way out of a
 * lockout during development, and it also means the limit is per instance
 * rather than shared across a horizontally scaled deployment. Give this a
 * database or Redis store before relying on it across more than one instance.
 */
export const SENSITIVE_AUTH_MAX_PER_MINUTE = (() => {
  const raw = process.env.AUTH_SENSITIVE_RATE_LIMIT_MAX;
  if (!raw) return 5;
  const parsed = Number(raw);
  // A non-numeric or non-positive value falls back to the safe default rather
  // than to NaN, which better-auth would treat as no limit at all.
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
})();
