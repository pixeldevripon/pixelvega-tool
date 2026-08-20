/**
 * A `Session` row as the Security tab reads it.
 *
 * The only interesting decision here is that the user agent is parsed on the
 * SERVER. A user agent string is not something a person can read, so somebody
 * has to turn it into "Chrome on macOS", and if that somebody is the browser
 * then two clients will disagree about the same session (D4). It is also the
 * kind of code that grows: the moment it lives in a component it acquires a
 * dozen more browsers and nobody notices it is presentation logic any more.
 */

type SessionRow = {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
};

/**
 * Ordered most specific first, because every one of these strings contains the
 * ones below it: Edge announces itself as Chrome and Safari, Chrome announces
 * itself as Safari. Matching in the wrong order labels every Edge session
 * "Safari", which is the classic bug in this fifteen-line function.
 */
const BROWSERS: ReadonlyArray<readonly [pattern: string, label: string]> = [
  ['Edg/', 'Edge'],
  ['OPR/', 'Opera'],
  ['Firefox/', 'Firefox'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
];

const PLATFORMS: ReadonlyArray<readonly [pattern: string, label: string]> = [
  ['iPhone', 'iPhone'],
  ['iPad', 'iPad'],
  ['Android', 'Android'],
  ['Mac OS X', 'macOS'],
  ['Windows', 'Windows'],
  ['Linux', 'Linux'],
];

function find(
  userAgent: string,
  table: ReadonlyArray<readonly [string, string]>,
): string | null {
  return table.find(([pattern]) => userAgent.includes(pattern))?.[1] ?? null;
}

/**
 * "Chrome on macOS", or whichever half could be identified, or null.
 *
 * Null rather than "Unknown device": a label the server invented is worse than
 * no label, because the screen can decide how to render an absence and cannot
 * un-invent a wrong answer.
 */
export function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = find(userAgent, BROWSERS);
  const platform = find(userAgent, PLATFORMS);
  if (browser && platform) return `${browser} on ${platform}`;
  return browser ?? platform;
}

/**
 * `currentToken` is the token off the request's own session, not an id.
 *
 * better-auth identifies a session by its token, and that is what the guard has
 * on `request.session`. Comparing ids would silently mark nothing as current,
 * which reads as "you are signed in nowhere" on a screen whose whole job is
 * telling you where you are signed in.
 *
 * The token itself never reaches the response. It is a bearer credential: an
 * account screen that printed one would hand a shoulder-surfer every session on
 * the list.
 */
export function toSessionResponse(row: SessionRow, currentToken: string) {
  const isCurrent = row.token === currentToken;
  return {
    id: row.id,
    isCurrent,
    device: describeDevice(row.userAgent),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    capabilities: {
      // The same predicate `revoke` asserts with. A row offering a Revoke that
      // then answers 400 is the defect this codebase has shipped five times.
      canRevoke: !isCurrent,
    },
  };
}
