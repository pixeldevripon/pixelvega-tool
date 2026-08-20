/**
 * Neutral query-string helper shared by both the client-side (`lib/api/fetch.ts`)
 * and server-side (`lib/api/public/fetch.ts`) data layers. Pure and isomorphic —
 * deliberately NOT `server-only`, so it is safe to import from client code.
 */

type QueryValue = string | number | boolean | undefined | null;

/**
 * Build a `?a=b&c=d` query string, dropping empty, undefined and null values.
 *
 * ── Arrays become REPEATED params, not a joined string ──
 *
 * `?projectTypes=WORDPRESS&projectTypes=SEO`, via `append`. The API accepts a
 * comma-joined form too, but repeating the key means no caller ever has to think
 * about what happens when a value legitimately contains a comma. An empty array
 * is dropped entirely rather than sent as an empty key, because `?types=` and
 * "no filter" must not be two different requests.
 */
export function buildQuery(
  params: Record<string, QueryValue | QueryValue[]>,
): string {
  const qs = new URLSearchParams();

  const isEmpty = (value: QueryValue) =>
    value === undefined || value === null || value === '';

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!isEmpty(entry)) qs.append(key, String(entry));
      }
      continue;
    }
    if (!isEmpty(value)) qs.set(key, String(value));
  }

  const str = qs.toString();
  return str ? `?${str}` : '';
}
