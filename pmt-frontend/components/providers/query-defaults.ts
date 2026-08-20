/**
 * The query cache's behaviour, in one place and without React.
 *
 * Split out of `query-provider.tsx` so the retry rule can be tested directly.
 * A retry rule expressed only inside a provider is a rule nobody checks, and
 * this one has to agree with `lib/api/fetch.ts` to avoid multiplying attempts.
 */

import type { DefaultOptions } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/fetch";

/**
 * How long a fetched value is treated as current.
 *
 * 30 seconds. Long enough that moving between two screens showing the same
 * project does not refetch it, short enough that a figure a colleague changed
 * shows up without a reload. Individual queries override it: a list behind a
 * filter is worth less staleness than a reference list of leave types.
 */
export const DEFAULT_STALE_TIME_MS = 30_000;

/** Attempts after the first. */
export const MAX_QUERY_RETRIES = 2;

/**
 * Statuses `apiFetch` has already retried by the time an error reaches here.
 *
 * Retrying them again would multiply, not add: three transport attempts inside
 * `apiFetch` times three query attempts is nine requests against an API that
 * has just said it is overloaded. The transport layer owns these two.
 */
const ALREADY_RETRIED_BY_TRANSPORT = new Set([429, 503]);

/**
 * Should this query be tried again?
 *
 * Queries are reads, so repeating one cannot corrupt anything, and the only
 * question is whether a repeat could plausibly succeed:
 *
 * - A 4xx is a settled answer. A 403 will be a 403 in two seconds, and
 *   retrying a 404 three times only makes a missing record load slowly.
 * - A 429 or 503 was already retried with backoff inside `apiFetch`.
 * - Anything else (status 0 for a dropped connection, a 5xx from an instance
 *   that is restarting) is worth two more attempts.
 *
 * Mutations are excluded entirely, below.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (!(error instanceof ApiError)) return false;
  if (ALREADY_RETRIED_BY_TRANSPORT.has(error.status)) return false;
  if (error.status >= 400 && error.status < 500) return false;
  return true;
}

/** Exponential backoff, capped so a third attempt is not a minute away. */
export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 10_000);
}

export const queryDefaults: DefaultOptions = {
  queries: {
    staleTime: DEFAULT_STALE_TIME_MS,
    retry: shouldRetryQuery,
    retryDelay: queryRetryDelay,

    // A dashboard is left open on a second monitor for hours. Coming back to
    // it should not show yesterday's numbers.
    refetchOnWindowFocus: true,

    // Refetching on every remount would undo the stale time, since this app
    // mounts a view per navigation.
    refetchOnMount: true,
  },
  mutations: {
    // Never. `apiFetch` refuses to retry a non-GET for the same reason: a 503
    // does not say whether the write landed, so a retry can create a second
    // record. A failed mutation is reported to the user, who decides.
    retry: false,
  },
};
