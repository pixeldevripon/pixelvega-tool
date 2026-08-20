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
 * So the rule is an allowlist of shapes, not a denylist of hosts. Anything that
 * is not obviously a path within this app is discarded and the caller falls back
 * to the dashboard, which is never wrong, only sometimes unhelpful.
 */

/** Where to go when `next` is absent, malformed, or hostile. */
export const DEFAULT_REDIRECT = "/dashboard";

/**
 * The only prefixes a redirect may target.
 *
 * Deliberately narrow. Allowing any path would let `next` point at
 * `/change-password`, which reads as harmless but drops a user into a flow they
 * did not start. Every legitimate interrupted navigation is a dashboard one,
 * because `proxy.ts` only guards `/dashboard`.
 */
const ALLOWED_PREFIXES = ["/dashboard"];

export function safeRedirect(next: string | null | undefined): string {
  if (!next) return DEFAULT_REDIRECT;

  // `//evil.example` is protocol relative: the browser reads it as an absolute
  // URL on another host, and it is the case a bare "starts with /" check misses.
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_REDIRECT;

  // A backslash is normalised to a forward slash by some browsers, so `/\evil`
  // and `\\evil` reach the same place as `//evil`.
  if (next.includes("\\")) return DEFAULT_REDIRECT;

  // Control characters, a newline or a tab among them, which can be used to
  // split a header or to smuggle a second URL past a naive check. Written as
  // escapes rather than as literal bytes so the source stays readable and an
  // editor cannot silently strip them.
  if (/[\u0000-\u001f\u007f]/.test(next)) return DEFAULT_REDIRECT;

  const path = next.split(/[?#]/)[0];
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  return allowed ? next : DEFAULT_REDIRECT;
}
