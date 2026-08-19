import { parseCorsOrigins } from './parse-cors-origins.util';

describe('parseCorsOrigins', () => {
  it('parses a single origin', () => {
    expect(parseCorsOrigins('http://localhost:3001')).toEqual([
      'http://localhost:3001',
    ]);
  });

  it('parses several comma separated origins', () => {
    expect(
      parseCorsOrigins('http://localhost:3001,https://pmt.pixelvega.com'),
    ).toEqual(['http://localhost:3001', 'https://pmt.pixelvega.com']);
  });

  it('trims whitespace around each origin', () => {
    expect(parseCorsOrigins(' http://a.com , http://b.com ')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('drops empty entries from a trailing or doubled comma', () => {
    expect(parseCorsOrigins('http://a.com,,http://b.com,')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('returns an empty list for undefined, so the allowlist fails CLOSED', () => {
    // An empty list denies every browser origin. That is the intended
    // behaviour: a missing env var must not silently allow everything.
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it('returns an empty list for an empty string', () => {
    expect(parseCorsOrigins('')).toEqual([]);
  });

  it('has no wildcard special case', () => {
    // '*' is treated as a literal origin, which matches nothing. Combined with
    // credentials: true a wildcard is invalid anyway, and env.validate.ts
    // rejects it at boot.
    expect(parseCorsOrigins('*')).toEqual(['*']);
  });
});
