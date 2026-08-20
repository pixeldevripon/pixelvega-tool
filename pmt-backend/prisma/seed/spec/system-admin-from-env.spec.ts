/**
 * The seed's own gate on the root account credentials.
 *
 * `src/env.validate.ts` guards the same three variables for the application, but
 * the seed is a script: it never boots Nest, so that validator never runs for
 * it. Without this function `pnpm seed` truncated 29 tables and then failed on
 * the first user row, leaving a database with no data and no login. Every case
 * below is a way to get that wrong.
 */

import { systemAdminFromEnv } from '../config';

const ENV_KEYS = ['ADMIN_EMAIL', 'ADMIN_NAME', 'ADMIN_PASSWORD'] as const;

describe('systemAdminFromEnv', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.ADMIN_EMAIL = 'root@pixelvega.com';
    process.env.ADMIN_NAME = 'Root Account';
    process.env.ADMIN_PASSWORD = 'a-real-root-password';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it('returns the three values', () => {
    expect(systemAdminFromEnv()).toEqual({
      email: 'root@pixelvega.com',
      name: 'Root Account',
      password: 'a-real-root-password',
    });
  });

  it('trims the email and the name, and leaves the password byte for byte', () => {
    process.env.ADMIN_EMAIL = '  root@pixelvega.com  ';
    process.env.ADMIN_NAME = '  Root Account  ';
    process.env.ADMIN_PASSWORD = '  spaces are real  ';

    // A stray space in a quoted .env value is a typo in an email and a
    // character in a password. Trimming the third would seed a hash of
    // something the operator cannot type.
    expect(systemAdminFromEnv()).toEqual({
      email: 'root@pixelvega.com',
      name: 'Root Account',
      password: '  spaces are real  ',
    });
  });

  it.each(ENV_KEYS)('throws, naming %s, when it is unset', (key) => {
    delete process.env[key];
    expect(() => systemAdminFromEnv()).toThrow(key);
  });

  it.each(ENV_KEYS)('throws, naming %s, when it is blank', (key) => {
    process.env[key] = key === 'ADMIN_PASSWORD' ? '' : '   ';
    expect(() => systemAdminFromEnv()).toThrow(key);
  });

  it('names every missing variable at once, not just the first', () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    // Fixing one at a time, reseeding, and finding the next is three round
    // trips for one .env edit.
    expect(() => systemAdminFromEnv()).toThrow(
      /ADMIN_EMAIL, ADMIN_PASSWORD must be set/,
    );
  });

  it('rejects an email with no @', () => {
    process.env.ADMIN_EMAIL = 'root';
    expect(() => systemAdminFromEnv()).toThrow(/not an email address: root/);
  });

  it("rejects a password below better-auth's eight character floor", () => {
    process.env.ADMIN_PASSWORD = 'short12'; // seven
    expect(() => systemAdminFromEnv()).toThrow(/at least 8 characters/);
  });

  it('accepts a password of exactly eight characters', () => {
    process.env.ADMIN_PASSWORD = 'eightch8';
    expect(systemAdminFromEnv().password).toBe('eightch8');
  });
});
