import { SetMetadata } from '@nestjs/common';

/**
 * The literal string `'PUBLIC'`, not a Symbol and not namespaced.
 *
 * `route-permissions.util.ts` reads this key to build the route gating matrix
 * that asserts no route is left ungated. If the key here and the key there ever
 * disagree, every public route reads as ungated and that assertion starts
 * checking nothing, which is the quiet kind of break a coverage test is meant
 * to catch rather than cause. Import the constant; never retype the string.
 */
export const IS_PUBLIC_KEY = 'PUBLIC';

/**
 * Opts a route out of `AuthGuard`.
 *
 * Every route is session protected by default, so each use of this needs a
 * reason in a comment above it. There are two: the auth catch-all itself
 * (a caller cannot have a session before signing in) and the health check.
 *
 * `AuthGuard` still resolves a session when one is present on a public route,
 * so `request.user` is populated for a signed in caller and a service level
 * ownership check keeps working.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
