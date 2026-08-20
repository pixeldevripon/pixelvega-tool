import { ApiError } from './humane-error';

/**
 * The description a list screen shows when its query failed.
 *
 * Every list view had this ternary written out longhand:
 *
 *     query.error instanceof Error ? query.error.message : 'Please try again.'
 *
 * Four copies, and the `instanceof` guard is the part that must not diverge:
 * TanStack types `error` as `unknown`, so a copy that reaches straight for
 * `.message` renders "undefined" on a non-Error rejection.
 *
 * `ApiError.message` is written to be shown to a person verbatim, which is the
 * whole reason `apiFetch` throws one: raw technical text never reaches a user.
 * A plain `Error` from the transport layer gets the fallback instead, because
 * "Failed to fetch" is not a sentence anybody can act on.
 */
export function listErrorDescription(
    error: unknown,
    fallback = 'Please try again.',
): string {
    if (error instanceof ApiError) return error.message;
    return fallback;
}
