import { Injectable, Logger, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';

import {
  INTERNAL_CLIENT_IP_HEADER,
  isTrustedInternalHeaders,
} from '@/auth/throttle/internal-origin.util';

/**
 * A ThrottlerGuard that understands first party server rendered callers.
 *
 * ── Why the default tracker is wrong here ──
 * The dashboard renders server side and calls this API server to server, so
 * `req.ip` is its egress address, the same value for every visitor. A per IP
 * limit on a route reached that way is one bucket shared by everyone, and it
 * trips under perfectly normal load.
 *
 * Skipping the throttle wholesale for trusted callers is too blunt: it also
 * dissolves the deliberately tight limits on the routes that set their own.
 * So the bypass is scoped (`hasOwnThrottleOverride`), and this guard closes the
 * gap that scoping leaves: a trusted caller may forward the real visitor's
 * address and be tracked by that, so limits land per visitor whether the
 * request came from a browser or through the rendering layer.
 */
@Injectable()
export class TrustedOriginThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(TrustedOriginThrottlerGuard.name);

  /**
   * Track by the forwarded visitor IP for a trusted caller, else by the
   * request's own IP. Falls back to the egress IP when a trusted caller sends
   * no header, so this can never throw or produce an empty bucket key.
   */
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<
      string,
      string | string[] | undefined
    >;
    if (isTrustedInternalHeaders(headers)) {
      const forwarded = headers[INTERNAL_CLIENT_IP_HEADER];
      // First entry only: a forwarded chain reads "client, proxy1, proxy2".
      const clientIp =
        typeof forwarded === 'string'
          ? forwarded.split(',')[0]?.trim()
          : undefined;
      if (clientIp) return Promise.resolve(`fwd:${clientIp}`);
    }
    // Narrowed rather than String()'d: `req` is loosely typed here, and
    // stringifying a non string `ip` yields "[object Object]", collapsing every
    // such request into ONE shared bucket.
    const ip = req.ip;
    return Promise.resolve(typeof ip === 'string' && ip ? ip : 'unknown');
  }

  /**
   * The same 429 as the default, plus a warning when the caller was first party.
   *
   * A throttled trusted origin is never routine: either an SSR caller hit a
   * route whose own `@Throttle()` excludes it from the bypass without
   * forwarding the visitor header, so everyone is sharing one bucket, or the
   * secret is being used by something that should not have it. Both would
   * otherwise surface only as mysterious intermittent 429s.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
    }>();
    if (isTrustedInternalHeaders(req.headers)) {
      this.logger.warn(
        `Trusted internal origin throttled on ${req.method ?? '?'} ${req.url ?? '?'} ` +
          `(limit ${throttlerLimitDetail.limit}/${throttlerLimitDetail.ttl}ms). ` +
          `If this route is called from the rendering layer it must forward ` +
          `${INTERNAL_CLIENT_IP_HEADER}, or every visitor shares one bucket.`,
      );
    }
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
