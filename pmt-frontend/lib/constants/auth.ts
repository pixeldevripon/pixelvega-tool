/**
 * The password policy, mirrored from the backend.
 *
 * `minPasswordLength: 8` in `pmt-backend/src/auth/instance/auth.instance.ts`.
 * This constant exists so a user sees the rule before a round trip, and it is a
 * CONVENIENCE, never the gate (D5): the API refuses a short password whatever
 * this file says. Where the two disagree the backend is right and this is the
 * bug.
 *
 * The copied dashboard hardcoded 12 here, which was its own backend's rule.
 * That mismatch would have rejected passwords the API accepts.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * How long a reset or invite token lives, in minutes.
 * `RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60` in the auth instance.
 */
export const RESET_TOKEN_TTL_MINUTES = 60;
