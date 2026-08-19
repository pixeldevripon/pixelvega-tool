/**
 * Parse the comma separated CORS_ORIGINS allowlist.
 *
 * Deliberately has no wildcard branch. This API sets `credentials: true` so
 * the session cookie can be sent cross origin, and browsers refuse that
 * combination with `*`. A wildcard here would therefore break every
 * authenticated call rather than relaxing anything, which is why
 * env.validate.ts rejects one outright.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
