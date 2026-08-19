import {
  INTERNAL_API_KEY_HEADER,
  INTERNAL_CLIENT_IP_HEADER,
} from './internal-origin.util';
import { TrustedOriginThrottlerGuard } from './trusted-origin-throttler.guard';

const SECRET = 'a-long-shared-internal-secret-value';

/** getTracker is protected; the guard's whole job is what it returns. */
type Trackable = { getTracker(req: Record<string, unknown>): Promise<string> };

describe('TrustedOriginThrottlerGuard.getTracker', () => {
  const original = process.env.INTERNAL_API_SECRET;
  let guard: Trackable;

  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = SECRET;
    guard = Object.create(TrustedOriginThrottlerGuard.prototype);
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = original;
  });

  it('tracks an ordinary caller by its own IP', async () => {
    await expect(
      guard.getTracker({ headers: {}, ip: '203.0.113.9' }),
    ).resolves.toBe('203.0.113.9');
  });

  it('tracks a trusted caller by the visitor IP it forwards', async () => {
    // The reason the guard exists: without this, every visitor rendered
    // server side shares the SSR server's one bucket.
    await expect(
      guard.getTracker({
        headers: {
          [INTERNAL_API_KEY_HEADER]: SECRET,
          [INTERNAL_CLIENT_IP_HEADER]: '198.51.100.7',
        },
        ip: '10.0.0.1',
      }),
    ).resolves.toBe('fwd:198.51.100.7');
  });

  it('takes only the first entry of a forwarded chain', async () => {
    await expect(
      guard.getTracker({
        headers: {
          [INTERNAL_API_KEY_HEADER]: SECRET,
          [INTERNAL_CLIENT_IP_HEADER]: '198.51.100.7, 10.0.0.2, 10.0.0.3',
        },
        ip: '10.0.0.1',
      }),
    ).resolves.toBe('fwd:198.51.100.7');
  });

  it('IGNORES a forwarded IP from an untrusted caller', async () => {
    // Otherwise anyone could mint a fresh bucket per request just by varying
    // a header, which is the whole limit defeated.
    await expect(
      guard.getTracker({
        headers: { [INTERNAL_CLIENT_IP_HEADER]: '198.51.100.7' },
        ip: '203.0.113.9',
      }),
    ).resolves.toBe('203.0.113.9');
  });

  it('falls back to the egress IP when a trusted caller forwards nothing', async () => {
    await expect(
      guard.getTracker({
        headers: { [INTERNAL_API_KEY_HEADER]: SECRET },
        ip: '10.0.0.1',
      }),
    ).resolves.toBe('10.0.0.1');
  });

  it('never returns an empty key', async () => {
    // An empty bucket key would put every such request in ONE bucket.
    await expect(guard.getTracker({ headers: {} })).resolves.toBe('unknown');
    await expect(guard.getTracker({ headers: {}, ip: '' })).resolves.toBe(
      'unknown',
    );
  });

  it('does not stringify a non string ip', async () => {
    // String({}) is "[object Object]", which would collapse every request with
    // a malformed ip into a single shared bucket.
    await expect(
      guard.getTracker({ headers: {}, ip: { addr: '1.2.3.4' } }),
    ).resolves.toBe('unknown');
  });
});
