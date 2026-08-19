import { timingSafeEqual } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Prefix `@Throttle()` uses for its per-name limit metadata
 * (`THROTTLER:LIMIT` + throttler name).
 *
 * Mirrored here rather than deep imported from
 * `@nestjs/throttler/dist/throttler.constants`, which the package does not
 * re-export from its root and could move on any upgrade. The co-located spec
 * asserts this still matches the library's own constant, so a rename fails the
 * suite loudly instead of silently widening the bypass back to every route.
 */
export const THROTTLER_LIMIT_METADATA_PREFIX = 'THROTTLER:LIMIT';

/**
 * Header a trusted first party caller uses to forward the REAL end user's IP.
 *
 * The dashboard renders server side and calls this API server to server, so
 * `req.ip` is its egress address and is identical for every visitor. Any per IP
 * limit on a route reached that way is one shared bucket for the whole
 * platform. When the caller proves it is first party (the secret below) it may
 * forward the visitor's own address here and be tracked by that instead.
 *
 * Honoured ONLY alongside a valid `x-internal-api-key`, so an anonymous client
 * cannot spoof its way into a fresh bucket.
 */
export const INTERNAL_CLIENT_IP_HEADER = 'x-real-client-ip';

/** Header carrying the shared internal secret. */
export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/** Constant time compare, so a wrong secret cannot be found by timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Length is compared first and NOT in constant time, deliberately: the
  // length of a secret is not the secret, and timingSafeEqual throws on a
  // length mismatch rather than returning false.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type HeaderBag = Record<string, string | string[] | undefined>;

/** True when these headers carry the configured internal API secret. */
export function isTrustedInternalHeaders(headers: HeaderBag): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  // Unset means the bypass never triggers, so a deployment that forgets the
  // variable is throttled rather than wide open.
  if (!secret) return false;
  const provided = headers[INTERNAL_API_KEY_HEADER];
  return typeof provided === 'string' && safeEqual(provided, secret);
}

/**
 * True when a request carries the internal API secret, identifying it as a
 * first party call from our own server rendering layer.
 *
 * Such calls may bypass the per IP throttle: rate limiting exists to stop
 * abusive anonymous clients, and our own SSR server legitimately bursts many
 * requests from one address while rendering a dashboard page. The secret is
 * server only and never shipped to a browser, so browser traffic stays
 * throttled.
 *
 * This exempts a request ONLY from the Nest throttle. It has no effect on
 * better-auth's own per path limiter in `auth.instance.ts`, which is what
 * actually guards sign-in.
 */
export function isTrustedInternalOrigin(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<{ headers: HeaderBag }>();
  return isTrustedInternalHeaders(req.headers);
}

/**
 * True when the handler, or its controller, declares its OWN `@Throttle()`.
 *
 * This is what scopes the bypass. A route overrides the global tiers precisely
 * because those tiers were too loose for it, so its limit is the whole
 * protection there and one leaked secret must not dissolve every one of them at
 * once.
 *
 * Using the presence of `@Throttle()` as the marker, rather than a separate
 * allowlist, means the rule cannot drift: tightening a route removes it from
 * the bypass automatically, with nothing to remember.
 *
 * Matched by metadata key PREFIX so it stays correct whichever throttler names
 * a route overrides.
 */
export function hasOwnThrottleOverride(context: ExecutionContext): boolean {
  for (const target of [context.getHandler(), context.getClass()]) {
    if (!target) continue;
    const keys = Reflect.getMetadataKeys(target) as unknown[];
    if (
      keys.some(
        (key) =>
          typeof key === 'string' &&
          key.startsWith(THROTTLER_LIMIT_METADATA_PREFIX),
      )
    ) {
      return true;
    }
  }
  return false;
}
