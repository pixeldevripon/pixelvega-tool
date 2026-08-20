/**
 * Validating a redirect target that came from the URL.
 *
 * `proxy.ts` puts the path a visitor was trying to reach into `?next=`, and the
 * sign-in page sends them there afterwards. That makes `next` attacker
 * controlled: anyone can send a colleague a link to
 * `/login?next=https://evil.example/harvest`, and a sign-in page that obeys it
 * hands over a user who has just typed their password and is expecting to land
 * somewhere trusted.
 *
 * So the rule is an allowlist of SHAPES, not a denylist of hosts. Anything that
 * is not obviously a path within this app is discarded and the caller falls back
 * to the app root, which is never wrong, only sometimes unhelpful.
 *
 * ── Why this is not a prefix allowlist ──
 *
 * It was, when the app lived under `/dashboard` and one prefix covered every
 * screen. This app is rooted at `/`, so a prefix list would have to name every
 * module and would silently reject each new one on the day it shipped. The
 * shape checks below are what actually stop the attacks; the only thing a path
 * allowlist added was rejecting `/change-password`-style flow entry, and that
 * is handled here by refusing the auth surface explicitly.
 */

/** Where to go when `next` is absent, malformed, or hostile. */
export const DEFAULT_REDIRECT = '/';

/**
 * Paths `next` may never point at.
 *
 * These are the signed-out screens. Sending a freshly signed-in user to
 * `/login` is a redirect loop, and sending them to `/set-password` drops them
 * into a token flow they did not start with no token to complete it.
 */
const REFUSED_PREFIXES = ['/login', '/set-password', '/reset-password'];

export function safeRedirect(
    next: string | null | undefined,
    fallback: string = DEFAULT_REDIRECT,
): string {
    if (!next) return fallback;

    // `//evil.example` is protocol relative: the browser reads it as an absolute
    // URL on another host, and it is the case a bare "starts with /" check misses.
    if (!next.startsWith('/') || next.startsWith('//')) return fallback;

    // A backslash is normalised to a forward slash by some browsers, so `/\evil`
    // and `\\evil` reach the same place as `//evil`.
    if (next.includes('\\')) return fallback;

    // Control characters, a newline or a tab among them, which can be used to
    // split a header or to smuggle a second URL past a naive check. Written as
    // escapes rather than as literal bytes so the source stays readable and an
    // editor cannot silently strip them.
    if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;

    const path = next.split(/[?#]/)[0];

    // Segment-aware, so `/loginish` is allowed while `/login` and `/login/forgot`
    // are refused. A bare `startsWith` would reject a legitimate future route
    // that merely shares a prefix.
    const refused = REFUSED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );

    return refused ? fallback : next;
}
