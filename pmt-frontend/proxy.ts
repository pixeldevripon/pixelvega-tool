import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * The route guard (Next 16's renamed middleware).
 *
 * Everything not listed in `UNGUARDED_PREFIXES` is the app, and the app needs a
 * session. That is the inverse of a public site with an admin area behind a
 * prefix: here there is nothing public to serve.
 */

/**
 * Optimistic guard: redirect to the sign-in page only when the session cookie is
 * absent. This is deliberately a cookie-PRESENCE check, never a backend call.
 *
 * The guard runs on every navigation AND every `<Link>` prefetch. An earlier
 * version of this file fetched `/api/auth/get-session` here with no internal
 * API key, so each of those requests counted against both the NestJS per-IP
 * throttle and better-auth's own limiter. In production the browser, this
 * guard, and SSR all reach the backend as one egress IP, so the get-session
 * storm exhausted the shared bucket after a few pages. A throttled 429 then
 * read as "no session" and bounced a signed-in user to the login page, whose
 * sign-in POST hit the same exhausted bucket.
 *
 * KEEP THIS FUNCTION FREE OF NETWORK CALLS. That property is the whole point.
 *
 * Authoritative validation still happens one hop later: the app layout reads
 * the session server-side, forwarding the internal key so it bypasses the
 * throttle, and redirects if the cookie is stale. A well-formed but expired
 * cookie therefore passes here and is caught there.
 *
 * A genuinely MALFORMED cookie is the case worth special handling. It would
 * pass a naive presence check, fail server validation on every request, and the
 * browser would keep resending the broken value: a redirect loop. So the shape
 * is checked and the cookies are STRIPPED on the way out, forcing a clean
 * sign-in instead.
 */
function guardApp(request: NextRequest) {
    const sessionToken = getSessionCookie(request);

    if (!sessionToken) {
        return NextResponse.redirect(signInUrl(request));
    }

    // A valid better-auth session cookie is exactly `<token>.<signature>`: two
    // non-empty segments. Anything else (no dot, an empty segment, or extra
    // segments from tampering) is corrupt.
    const parts = sessionToken.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        const response = NextResponse.redirect(signInUrl(request));
        clearSessionCookies(request, response);
        return response;
    }

    return NextResponse.next();
}

/**
 * The sign-in URL, carrying where the visitor was trying to go.
 *
 * `next` is read back by the sign-in card through `safeRedirect`, which refuses
 * anything that is not a same-origin path. Without that check this parameter
 * would be an open redirect on the login page, which is a phishing primitive.
 */
function signInUrl(request: NextRequest): URL {
    const url = new URL('/login', request.url);
    const { pathname, search } = request.nextUrl;
    if (pathname !== '/') {
        url.searchParams.set('next', `${pathname}${search}`);
    }
    return url;
}

/**
 * Expire every better-auth session cookie present on the request (the token and
 * the data cookie, in both plain and `__Secure-` prefixed forms). Deleting by
 * the exact names seen on the request preserves whatever prefix the deployment
 * uses and is a no-op for names that are absent.
 *
 * If production ever sets the cookie on a parent domain
 * (better-auth's `crossSubDomainCookies`), the delete MUST echo the same
 * `domain` and `path`: a host-scoped delete does not match a domain-scoped
 * cookie, so the strip would silently no-op exactly where it matters. That is
 * what `COOKIE_DOMAIN` is for, and it must stay in step with the backend's auth
 * instance.
 */
function clearSessionCookies(request: NextRequest, response: NextResponse) {
    const domain =
        process.env.NODE_ENV === 'production'
            ? process.env.COOKIE_DOMAIN
            : undefined;

    for (const { name } of request.cookies.getAll()) {
        if (name.includes('session_token') || name.includes('session_data')) {
            response.cookies.delete({
                name,
                path: '/',
                ...(domain && { domain }),
            });
        }
    }
}

/**
 * Paths that must NOT hit the session guard.
 *
 * The signed-out screens, because guarding them is a redirect loop: no session
 * sends you to `/login`, which has no session, which sends you to `/login`.
 *
 * `/set-password` and `/reset-password` are reached from an emailed link, very
 * often on a phone with no session at all. Guarding them would bounce the link
 * and drop the `?token=` it exists to read. They are safe to leave open because
 * the single-use token IS the credential, which is also why the backend route
 * that redeems it is `@Public`.
 */
const UNGUARDED_PREFIXES = [
    '/login',
    '/set-password',
    '/reset-password',
    '/api',
];

function isUnguarded(pathname: string): boolean {
    return UNGUARDED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isUnguarded(pathname)) {
        return NextResponse.next();
    }

    return guardApp(request);
}

export const config = {
    // Everything except Next internals and files with an extension.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
