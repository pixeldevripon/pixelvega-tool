import { describeDevice, toSessionResponse } from '../session.mapper';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('describeDevice', () => {
  it('names the browser and the platform', () => {
    expect(describeDevice(CHROME_MAC)).toBe('Chrome on macOS');
  });

  it('picks Edge over the Chrome and Safari it also claims to be', () => {
    // Every one of these strings contains the ones below it. Matching in the
    // wrong order labels every Edge session "Safari", which is the classic bug
    // in this function.
    expect(describeDevice(EDGE_WINDOWS)).toBe('Edge on Windows');
  });

  it('recognises mobile Safari', () => {
    expect(describeDevice(SAFARI_IPHONE)).toBe('Safari on iPhone');
  });

  it('returns the half it could identify', () => {
    expect(describeDevice('curl/8.4.0 (Linux)')).toBe('Linux');
  });

  it('returns null rather than inventing a label', () => {
    // A label the server invented is worse than no label: the screen can decide
    // how to render an absence and cannot un-invent a wrong answer.
    expect(describeDevice(null)).toBeNull();
    expect(describeDevice('curl/8.4.0')).toBeNull();
  });
});

describe('toSessionResponse', () => {
  const row = {
    id: 's1',
    token: 'tok-current',
    ipAddress: '203.0.113.7',
    userAgent: CHROME_MAC,
    createdAt: new Date('2026-08-19T14:32:00.000Z'),
    expiresAt: new Date('2026-09-19T14:32:00.000Z'),
  };

  it('never puts the session token on the response', () => {
    // It is a bearer credential. An account screen that printed one would hand
    // a shoulder-surfer every session on the list.
    const result = toSessionResponse(row, 'tok-current');
    expect(result).not.toHaveProperty('token');
    expect(JSON.stringify(result)).not.toContain('tok-current');
  });

  it('marks the session the request arrived on by TOKEN, not by id', () => {
    // better-auth identifies a session by its token. Comparing ids would mark
    // nothing as current, which reads as "you are signed in nowhere" on a
    // screen whose whole job is telling you where you are signed in.
    expect(toSessionResponse(row, 'tok-current').isCurrent).toBe(true);
    expect(toSessionResponse(row, 'tok-other').isCurrent).toBe(false);
  });

  it('refuses to offer a revoke on the current session', () => {
    expect(toSessionResponse(row, 'tok-current').capabilities.canRevoke).toBe(
      false,
    );
  });

  it('offers a revoke on every other session', () => {
    expect(toSessionResponse(row, 'tok-other').capabilities.canRevoke).toBe(
      true,
    );
  });

  it('carries the address and the two dates through unchanged', () => {
    const result = toSessionResponse(row, 'tok-other');
    expect(result.ipAddress).toBe('203.0.113.7');
    expect(result.createdAt).toEqual(row.createdAt);
    expect(result.expiresAt).toEqual(row.expiresAt);
  });
});
