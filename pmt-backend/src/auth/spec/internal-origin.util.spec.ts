import 'reflect-metadata';
import { Throttle } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

import {
  INTERNAL_API_KEY_HEADER,
  INTERNAL_CLIENT_IP_HEADER,
  THROTTLER_LIMIT_METADATA_PREFIX,
  hasOwnThrottleOverride,
  isTrustedInternalHeaders,
  isTrustedInternalOrigin,
} from '@/auth/throttle/internal-origin.util';

const SECRET = 'a-long-shared-internal-secret-value';

function contextWith(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('isTrustedInternalHeaders', () => {
  const original = process.env.INTERNAL_API_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = original;
  });

  it('is false when no secret is configured, so a deployment that forgets it is throttled rather than open', () => {
    delete process.env.INTERNAL_API_SECRET;
    expect(
      isTrustedInternalHeaders({ [INTERNAL_API_KEY_HEADER]: 'anything' }),
    ).toBe(false);
  });

  it('is true for the exact secret', () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    expect(
      isTrustedInternalHeaders({ [INTERNAL_API_KEY_HEADER]: SECRET }),
    ).toBe(true);
  });

  it('is false for a wrong secret of the same length', () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    const wrong = 'b'.repeat(SECRET.length);
    expect(isTrustedInternalHeaders({ [INTERNAL_API_KEY_HEADER]: wrong })).toBe(
      false,
    );
  });

  it('is false for a wrong secret of a different length, without throwing', () => {
    // timingSafeEqual throws on a length mismatch, so the length is checked
    // first. This asserts that path returns false rather than exploding.
    process.env.INTERNAL_API_SECRET = SECRET;
    expect(
      isTrustedInternalHeaders({ [INTERNAL_API_KEY_HEADER]: 'short' }),
    ).toBe(false);
  });

  it('is false when the header is absent or repeated', () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    expect(isTrustedInternalHeaders({})).toBe(false);
    // A repeated header arrives as an array; only a single string counts.
    expect(
      isTrustedInternalHeaders({
        [INTERNAL_API_KEY_HEADER]: [SECRET, SECRET],
      }),
    ).toBe(false);
  });

  it('reads the header from a real execution context too', () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    expect(
      isTrustedInternalOrigin(
        contextWith({ [INTERNAL_API_KEY_HEADER]: SECRET }),
      ),
    ).toBe(true);
    expect(isTrustedInternalOrigin(contextWith({}))).toBe(false);
  });
});

describe('THROTTLER_LIMIT_METADATA_PREFIX', () => {
  it('still matches the key @Throttle() actually writes', () => {
    // The whole point of this test. The prefix is mirrored rather than imported,
    // because the library does not re-export it from its root. If a version bump
    // renames it, `hasOwnThrottleOverride` silently stops recognising tightened
    // routes and widens the bypass to all of them. This fails loudly instead.
    class Probe {
      @Throttle({ default: { limit: 1, ttl: 1000 } })
      handler() {}
    }
    const keys = Reflect.getMetadataKeys(Probe.prototype.handler) as string[];
    expect(
      keys.some((key) => key.startsWith(THROTTLER_LIMIT_METADATA_PREFIX)),
    ).toBe(true);
  });
});

describe('hasOwnThrottleOverride', () => {
  class Tightened {
    @Throttle({ default: { limit: 3, ttl: 60_000 } })
    tight() {}

    loose() {}
  }

  function contextFor(handler: object, cls: object): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
  }

  it('is true for a handler that set its own limit', () => {
    expect(
      hasOwnThrottleOverride(contextFor(Tightened.prototype.tight, Tightened)),
    ).toBe(true);
  });

  it('is false for a handler that did not', () => {
    // This is what makes the bypass apply: the route is on the global tiers,
    // so a trusted first party caller may skip them.
    expect(
      hasOwnThrottleOverride(contextFor(Tightened.prototype.loose, Tightened)),
    ).toBe(false);
  });

  it('is true when the CONTROLLER set a limit, even if the handler did not', () => {
    @Throttle({ default: { limit: 3, ttl: 60_000 } })
    class TightController {
      handler() {}
    }
    expect(
      hasOwnThrottleOverride(
        contextFor(TightController.prototype.handler, TightController),
      ),
    ).toBe(true);
  });
});

describe('the forwarded client IP header', () => {
  it('is a distinct header from the secret, so one cannot be mistaken for the other', () => {
    expect(INTERNAL_CLIENT_IP_HEADER).not.toBe(INTERNAL_API_KEY_HEADER);
  });
});
