/**
 * `better-auth/api` ships ESM that Jest's CJS transform cannot parse, the same
 * reason `route-permissions.spec.ts` mocks the package.
 *
 * The stand-in keeps the one property this spec asserts on: an `APIError`
 * carries its `body`. That is enough for what is being pinned here, which is
 * that the hook throws BETTER-AUTH's error type rather than a Nest exception.
 * These hooks run inside better-auth's handler, mounted as middleware, which
 * never reaches Nest's exception filter: a `BadRequestException` thrown here
 * escapes unmapped and surfaces to the user as a 500.
 */
jest.mock('better-auth/api', () => ({
  APIError: class APIError extends Error {
    constructor(
      public status: string,
      public body: { message: string; code: string },
    ) {
      super(body.message);
    }
  },
}));

import { APIError } from 'better-auth/api';

import {
  PASSWORD_WRITE_PATHS,
  assertPasswordMeetsPolicy,
} from '@/auth/instance/password-policy.hook';

const STRONG = 'Correct-Horse9!';
const WEAK = 'password';

describe('PASSWORD_WRITE_PATHS', () => {
  it('covers every better-auth path that sets a password', () => {
    // A rule enforced on two of the three is not enforced. If better-auth grows
    // a fourth, this list stops describing the surface and the checklist on the
    // account screen quietly starts lying.
    expect([...PASSWORD_WRITE_PATHS].sort()).toEqual([
      '/change-password',
      '/reset-password',
      '/sign-up/email',
    ]);
  });
});

describe('assertPasswordMeetsPolicy', () => {
  it('reads `password` on sign-up', () => {
    expect(() =>
      assertPasswordMeetsPolicy({
        path: '/sign-up/email',
        body: { password: WEAK },
      }),
    ).toThrow(APIError);
  });

  it('reads `newPassword` on change-password', () => {
    expect(() =>
      assertPasswordMeetsPolicy({
        path: '/change-password',
        body: { currentPassword: STRONG, newPassword: WEAK },
      }),
    ).toThrow(APIError);
  });

  it('reads `newPassword` on reset-password, not `password`', () => {
    // Getting the field name wrong does not fail loudly: the value reads as
    // undefined, the check is skipped, and the policy silently stops applying
    // to the emailed reset link.
    expect(() =>
      assertPasswordMeetsPolicy({
        path: '/reset-password',
        body: { newPassword: WEAK, token: 'tok' },
      }),
    ).toThrow(APIError);
  });

  it('does not look at the CURRENT password on a change', () => {
    // It is whatever the account already has, which may predate this policy.
    // Checking it would lock people out of changing a weak password.
    expect(() =>
      assertPasswordMeetsPolicy({
        path: '/change-password',
        body: { currentPassword: WEAK, newPassword: STRONG },
      }),
    ).not.toThrow();
  });

  it('lets a strong password through on every path', () => {
    for (const path of PASSWORD_WRITE_PATHS) {
      const field = path === '/sign-up/email' ? 'password' : 'newPassword';
      expect(() =>
        assertPasswordMeetsPolicy({ path, body: { [field]: STRONG } }),
      ).not.toThrow();
    }
  });

  it("throws better-auth's error type, not a Nest exception", () => {
    // These hooks run inside better-auth's handler, which is mounted as
    // middleware and never reaches Nest's exception filter. A
    // BadRequestException thrown here escapes unmapped and surfaces as a 500.
    try {
      assertPasswordMeetsPolicy({
        path: '/change-password',
        body: { newPassword: WEAK },
      });
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).body?.code).toBe('PASSWORD_TOO_WEAK');
    }
  });

  it('names every missing requirement, so one mistake is not five round trips', () => {
    try {
      assertPasswordMeetsPolicy({
        path: '/change-password',
        body: { newPassword: 'aaaaaaaaaaaaaa' },
      });
      throw new Error('expected a refusal');
    } catch (error) {
      const message = (error as APIError).body?.message ?? '';
      expect(message).toContain('at least 1 uppercase letter');
      expect(message).toContain('at least 1 number');
      expect(message).toContain('at least 1 special character');
    }
  });

  it('defers to better-auth when the field is missing or not a string', () => {
    // The body is validated AFTER hooks.before runs, so a wrong shape is not
    // this function's error to report.
    expect(() =>
      assertPasswordMeetsPolicy({ path: '/change-password', body: {} }),
    ).not.toThrow();
    expect(() =>
      assertPasswordMeetsPolicy({ path: '/change-password', body: undefined }),
    ).not.toThrow();
    expect(() =>
      assertPasswordMeetsPolicy({
        path: '/change-password',
        body: { newPassword: 12345 },
      }),
    ).not.toThrow();
  });
});
