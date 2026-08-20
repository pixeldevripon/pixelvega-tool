import 'server-only';

import { headers } from 'next/headers';

/**
 * Headers for a server-to-server call to the backend.
 *
 * Two things travel, and they only work as a pair.
 *
 * ── 1. The visitor's session cookie ──
 *
 * Authenticates the call AS that person. Without it the backend sees an
 * anonymous request.
 *
 * ── 2. The internal API secret, and the visitor's real IP ──
 *
 * `x-internal-api-key` identifies this as a first-party caller, which lets it
 * bypass the backend's per-IP Nest throttle. That bypass is needed because this
 * app renders server side: the backend sees ONE address for every visitor, and
 * a per-IP limit reached that way is a single bucket shared by the whole
 * company, which trips under ordinary load.
 *
 * `x-real-client-ip` is the other half, and **omitting it is the defect this
 * file existed with.** The backend's bypass is deliberately SCOPED: a route that
 * declares its own `@Throttle()` did so because the global tiers were too loose
 * for it, so one leaked secret must not dissolve every tightened limit at once.
 * On those routes the trusted caller is still throttled, and still by IP. If it
 * does not forward the visitor's address, every visitor is tracked as this
 * server and shares one bucket, which is exactly the failure the bypass was
 * meant to avoid.
 *
 * `TrustedOriginThrottlerGuard` logs a warning when a trusted origin is
 * throttled, for this reason. A 429 on a first-party call is never routine.
 *
 * The header is honoured ONLY alongside a valid secret, so a browser cannot
 * spoof itself a fresh bucket. Both header names mirror
 * `pmt-backend/src/auth/throttle/internal-origin.util.ts` and must stay in step
 * with it.
 *
 * ── Why this reads the request rather than taking arguments ──
 *
 * A caller that forgets to pass the IP produces no error, no warning and no
 * visible symptom until a shared bucket trips in production. Reading it here
 * means there is nothing to remember: the same reason the backend keys its
 * bypass off the presence of `@Throttle()` rather than an allowlist.
 *
 * ── It exempts the Nest throttle ONLY ──
 *
 * better-auth's own per-path limiter on `/api/auth/*` is a separate layer, and
 * the secret has no effect on it. That limiter is what guards sign-in, and it is
 * tuned by `AUTH_SENSITIVE_RATE_LIMIT_MAX` on the backend.
 *
 * `server-only` guarantees the secret can never be pulled into a client bundle.
 * NEVER read it as `NEXT_PUBLIC_*`.
 */
export async function serverAuthHeaders(): Promise<Record<string, string>> {
    const incoming = await headers();

    const result: Record<string, string> = {
        cookie: incoming.get('cookie') ?? '',
    };

    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
        // No secret means the bypass never triggers, so a deployment that
        // forgets the variable is throttled rather than open. Forwarding the IP
        // without it would be ignored by the backend anyway.
        return result;
    }

    result['x-internal-api-key'] = secret;

    const clientIp = visitorIp(incoming);
    if (clientIp) {
        result['x-real-client-ip'] = clientIp;
    }

    return result;
}

/**
 * The visitor's address, as seen by whatever sits in front of this app.
 *
 * `x-forwarded-for` is a chain reading "client, proxy1, proxy2", so the first
 * entry is the one that matters. Nothing here validates it, deliberately: this
 * app is not the trust boundary for that value, the proxy in front of it is, and
 * the backend only honours the forwarded header alongside a secret a browser
 * never sees.
 *
 * Returns undefined in local development, where there is no proxy and no
 * forwarded header. That is correct rather than a gap: the backend then falls
 * back to the request's own IP, which locally is the same machine anyway.
 */
function visitorIp(incoming: Awaited<ReturnType<typeof headers>>) {
    const forwardedFor = incoming.get('x-forwarded-for');
    if (forwardedFor) {
        const first = forwardedFor.split(',')[0]?.trim();
        if (first) return first;
    }
    // Set by several proxies (nginx, Vercel) as a single address rather than a
    // chain, so it needs no splitting.
    return incoming.get('x-real-ip') ?? undefined;
}
