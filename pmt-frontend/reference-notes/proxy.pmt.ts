import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * An optimistic session check, and nothing more.
 *
 * `proxy.ts` is what Next.js 16 calls the file that used to be `middleware.ts`.
 * The name change is the library's, and it describes the job better: this runs
 * before a route renders, on the edge, with no access to the database and no
 * business doing authorization.
 *
 * ## What this does, and what it deliberately does not
 *
 * It looks for the SHAPE of a session cookie. It does not read the cookie, does
 * not verify its signature, does not call the API, and does not know who the
 * user is. Three reasons, in order of how much they matter:
 *
 * 1. **The API is the control, and must stay the only one.** Every endpoint runs
 *    `AuthGuard` then `PermissionsGuard`. A check here that looked
 *    authoritative would become a second place where access is decided, and the
 *    two would eventually disagree. When they do, the one in the browser's
 *    request path is the one an attacker gets to skip.
 * 2. **A network call here is on the critical path of every navigation.** Next's
 *    own guidance is explicit that proxy is not for data fetching: it would add
 *    a round trip to the API before any HTML is sent, on every request.
 * 3. **A forged cookie gains nothing.** Setting `better-auth.session_token` to
 *    any value at all gets you past this and onto a dashboard shell whose every
 *    request then 401s. That is the same outcome as before, one screen later.
 *
 * So what is it FOR? A flash. Without it, an expired session renders the whole
 * dashboard chrome, fires a dozen requests, collects a dozen 401s and only then
 * redirects to sign in. This turns that into a redirect before anything is
 * drawn.
 *
 * ## The deployment constraint, which is real
 *
 * The cookie is set by the API on the API's own host. This code runs on the
 * dashboard's host. It can only see the cookie if the browser sends it to both,
 * which is true when they share a registrable domain (`api.example.com` and
 * `app.example.com`), and true in development because cookies ignore the port
 * so `localhost:5050` and `localhost:3000` are one host.
 *
 * If a deployment ever puts them on unrelated domains, this guard would see no
 * cookie for a perfectly valid session and redirect every signed-in user to the
 * sign-in page. `SESSION_GUARD=off` turns it off for exactly that case. It is
 * a server-side variable on purpose: `NEXT_PUBLIC_` would inline it into the
 * bundle, and this is not a decision a browser participates in.
 */

/**
 * better-auth's default cookie name. `__Secure-` is prefixed automatically when
 * the library infers a secure context from its base URL, so both are checked.
 * No `cookiePrefix` is configured in `auth.instance.ts`; if one is ever added,
 * this list is the other half of that change.
 */
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

/** Signed-in users have no business on these, and get sent to their dashboard. */
const ANONYMOUS_ONLY = ["/login", "/forgot-password"];

/**
 * Where an unauthenticated visitor is sent, and where they come back to.
 *
 * The original path travels as `next` so that a link into a specific project
 * survives the sign-in it triggered.
 */
const SIGN_IN_PATH = "/login";

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function proxy(request: NextRequest) {
  // The escape hatch for a split-domain deployment. Checked first so that
  // turning the guard off cannot be defeated by anything below it.
  if (process.env.SESSION_GUARD === "off") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const hasSession = hasSessionCookie(request);

  if (!hasSession && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = "";
    // `pathname + search` rather than the full URL: a caller-controlled
    // absolute URL in a redirect param is an open redirect, and this value is
    // read back by the sign-in page.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && ANONYMOUS_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Only the paths where the answer can change what renders.
   *
   * Without a matcher this runs on every request including `_next/static`,
   * `_next/image` and everything in `public/`, so a redirect intended for a
   * page would also fire for a stylesheet and the app would load unstyled.
   *
   * `/change-password` and `/profile-setup` are deliberately absent: an invited
   * user reaches them mid-flow and the API decides whether they are allowed to
   * be there, from `mustResetPassword` rather than from having a cookie.
   */
  matcher: ["/dashboard/:path*", "/login", "/forgot-password"],
};
