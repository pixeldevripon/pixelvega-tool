/**
 * Unit tests for boot-time environment validation.
 *
 * The value of this file is that it fails when someone adds a variable to the
 * code without adding it here: the whole point of validateEnv is that the list
 * is complete.
 */

import { ENV_KEYS, validateEnv } from './env.validate';

function validEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/pixelvega',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
    PORT: '3000',
    CORS_ORIGINS: 'http://localhost:3001',
    ADMIN_EMAIL: 'admin@pixelvega.com',
    ADMIN_NAME: 'System Admin',
    ADMIN_PASSWORD: 'a-real-root-password',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('accepts a complete, valid environment', () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it('accepts an environment with no optional variables set at all', () => {
    // Every optional feature degrades to a no-op rather than crashing, so the
    // app must boot without any of them.
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  describe('required variables', () => {
    it.each(ENV_KEYS.required)('rejects a missing %s', (key) => {
      const env = validEnv();
      delete env[key];
      expect(() => validateEnv(env)).toThrow(new RegExp(`${key} is required`));
    });

    it.each(ENV_KEYS.required)('rejects an empty %s', (key) => {
      expect(() => validateEnv(validEnv({ [key]: '' }))).toThrow(
        new RegExp(`${key} is required`),
      );
    });
  });

  describe('reporting', () => {
    it('reports EVERY problem at once, not just the first', () => {
      // Fixing one variable per restart is a miserable loop.
      const env = validEnv();
      delete env.DATABASE_URL;
      delete env.PORT;
      expect(() => validateEnv(env)).toThrow(
        /DATABASE_URL[\s\S]*PORT|PORT[\s\S]*DATABASE_URL/,
      );
    });

    it('points the reader at .env.example', () => {
      expect(() => validateEnv({})).toThrow(/\.env\.example/);
    });
  });

  describe('specific rules', () => {
    it('rejects a DATABASE_URL that is not a postgres connection string', () => {
      expect(() =>
        validateEnv(validEnv({ DATABASE_URL: 'mysql://x/y' })),
      ).toThrow(/postgres connection string/);
    });

    it('rejects a BETTER_AUTH_SECRET shorter than 32 characters', () => {
      expect(() =>
        validateEnv(validEnv({ BETTER_AUTH_SECRET: 'short' })),
      ).toThrow(/at least 32 characters/);
    });

    it('rejects a placeholder secret even when it is long enough', () => {
      // A 40 character string that still says "change-me" passes a naive
      // length check and is exactly what ships to production by accident.
      expect(() =>
        validateEnv(validEnv({ BETTER_AUTH_SECRET: 'change-me-'.repeat(4) })),
      ).toThrow(/placeholder detected/);
    });

    it('rejects an unknown NODE_ENV', () => {
      expect(() => validateEnv(validEnv({ NODE_ENV: 'staging' }))).toThrow(
        /must be one of/,
      );
    });

    it.each(['development', 'production', 'test'])(
      'accepts NODE_ENV=%s',
      (value) => {
        expect(() => validateEnv(validEnv({ NODE_ENV: value }))).not.toThrow();
      },
    );

    it('rejects a non numeric PORT', () => {
      expect(() => validateEnv(validEnv({ PORT: 'abc' }))).toThrow(
        /positive integer/,
      );
    });

    it('rejects a WILDCARD in CORS_ORIGINS', () => {
      // The whole reason the old CORS_ORIGIN fallback was broken: browsers
      // reject '*' when credentials are sent, so a wildcard breaks every
      // authenticated call rather than relaxing anything.
      expect(() => validateEnv(validEnv({ CORS_ORIGINS: '*' }))).toThrow(
        /must not contain a wildcard/,
      );
    });

    it('accepts several comma separated origins', () => {
      expect(() =>
        validateEnv(
          validEnv({
            CORS_ORIGINS: 'http://localhost:3001,https://pmt.pixelvega.com',
          }),
        ),
      ).not.toThrow();
    });

    it('rejects an ADMIN_EMAIL that is not an email', () => {
      expect(() => validateEnv(validEnv({ ADMIN_EMAIL: 'admin' }))).toThrow(
        /must be an email/,
      );
    });

    it("rejects an ADMIN_PASSWORD below better-auth's eight character floor", () => {
      // Seven characters. A shorter root password creates an account that
      // cannot sign in, and the failure would only show at the login screen.
      expect(() =>
        validateEnv(validEnv({ ADMIN_PASSWORD: 'short12' })),
      ).toThrow(/at least 8 characters/);
    });

    it('rejects a placeholder ADMIN_PASSWORD', () => {
      expect(() =>
        validateEnv(validEnv({ ADMIN_PASSWORD: 'change-me-please' })),
      ).toThrow(/placeholder detected/);
    });

    it('accepts an eight character ADMIN_PASSWORD', () => {
      expect(() =>
        validateEnv(validEnv({ ADMIN_PASSWORD: 'eightch8' })),
      ).not.toThrow();
    });
  });

  describe('optional variables', () => {
    it('ignores an optional variable that is absent', () => {
      expect(() => validateEnv(validEnv())).not.toThrow();
    });

    it('still validates an optional variable that IS set', () => {
      expect(() => validateEnv(validEnv({ SMTP_PORT: 'not-a-port' }))).toThrow(
        /SMTP_PORT/,
      );
    });

    it('accepts a valid optional variable', () => {
      expect(() => validateEnv(validEnv({ SMTP_PORT: '587' }))).not.toThrow();
    });
  });

  describe('the declared list matches what the code reads', () => {
    it('declares every variable, with no duplicates between the two lists', () => {
      const overlap = ENV_KEYS.required.filter((k) =>
        ENV_KEYS.optional.includes(k),
      );
      expect(overlap).toEqual([]);
    });

    it('declares the variables the app cannot start without', () => {
      expect(ENV_KEYS.required).toEqual(
        expect.arrayContaining([
          'DATABASE_URL',
          'BETTER_AUTH_SECRET',
          'BETTER_AUTH_URL',
          'NODE_ENV',
          'PORT',
          'CORS_ORIGINS',
          'ADMIN_EMAIL',
          'ADMIN_NAME',
          'ADMIN_PASSWORD',
        ]),
      );
    });

    it('declares every feature gated variable as optional', () => {
      expect(ENV_KEYS.optional).toEqual(
        expect.arrayContaining([
          'SMTP_HOST',
          'SMTP_PORT',
          'SMTP_USER',
          'SMTP_PASS',
          'MAIL_FROM',
          'CLOUDINARY_CLOUD_NAME',
          'CLOUDINARY_API_KEY',
          'CLOUDINARY_API_SECRET',
          'SLACK_BOT_TOKEN',
          'SLACK_DAILY_FEED_CHANNEL_ID',
          'ANTHROPIC_API_KEY',
          'REDIS_URL',
        ]),
      );
    });
  });
});
