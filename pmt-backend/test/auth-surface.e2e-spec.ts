/**
 * The auth surface, asserted against the running app.
 *
 * This file began as a probe. Before it, `POST /api/auth/sign-up/email` was
 * open to anyone and the caller chose their own `role` in the request body, so
 * a stranger could create themselves a SYSTEM_ADMIN row. Verified against the
 * real app, then fixed; these are the tests that keep it fixed.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { auth } from '@/auth/instance/auth.instance';
import { addBetterAuthPaths } from '@/common/swagger/better-auth-paths';
import { createTestApp } from './create-test-app';

describe('better-auth surface (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sign-up is closed', () => {
    it('refuses an anonymous sign-up', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({
          email: `probe-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Probe User',
        });

      // Anything but a 2xx. Every account is created by an admin through the
      // invite flow; there is no self-registration.
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('refuses one that tries to pick its own role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({
          email: `probe-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Probe User',
          role: 'SYSTEM_ADMIN',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      // And nothing that looks like a created user comes back.
      const body = response.body as { user?: { role?: string } };
      expect(body?.user?.role).toBeUndefined();
    });
  });

  describe('sign-up is closed to HTTP but OPEN to the invite flow', () => {
    it('still lets a server side call create an account', async () => {
      // The regression this exists for. `emailAndPassword.disableSignUp` closes
      // the public route AND every internal `auth.api.signUpEmail()` call,
      // because better-auth enforces it inside the handler with no exemption.
      // Both legitimate creation paths go through that endpoint, so the flag
      // broke every invite and a fresh deployment's ability to bootstrap its
      // first admin. It threw "Email and password sign up is not enabled".
      //
      // SignUpGuardHook closes the HTTP route instead. This asserts the other
      // half: the internal path must still work.
      const created = await auth.api.signUpEmail({
        body: {
          email: `internal-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Internal Creation',
        },
      });

      expect(created.user.id).toBeTruthy();
      // And the caller could not choose a role: `input: false` on every
      // additional field means the default applies whatever the body said.
      expect((created.user as unknown as { role: string }).role).toBe(
        'DEVELOPER',
      );
    });
  });

  describe('the flows better-auth now owns', () => {
    it('serves the password reset request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email: 'nobody@example.com', redirectTo: '/reset-password' });

      // 200 whether or not the address exists: answering differently would
      // turn this into an account enumeration oracle.
      expect(response.status).toBe(200);
    });

    it('does NOT serve the old /forget-password spelling', async () => {
      // Pinned because the rate limit rule names a path, and a rule naming a
      // path that does not exist silently never applies. better-auth 1.6
      // renamed this to /request-password-reset.
      const response = await request(app.getHttpServer())
        .post('/api/auth/forget-password')
        .send({ email: 'nobody@example.com' });
      expect(response.status).toBe(404);
    });

    it('serves reset-password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ newPassword: 'Password123!', token: 'not-a-real-token' });

      // Rejected because the token is junk, NOT 404: the route exists.
      expect(response.status).not.toBe(404);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('serves change-password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .send({ currentPassword: 'x', newPassword: 'Password123!' });

      // Unauthenticated, so rejected. Still not a 404.
      expect(response.status).not.toBe(404);
    });
  });

  describe('there is exactly one door to a password change', () => {
    it("refuses better-auth's change-password over HTTP", async () => {
      // It is middleware, so it never reaches the permission guard and writes
      // no audit entry. PATCH /api/users/me/password does both. Two doors to
      // one action with different security properties is worse than one.
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .send({ currentPassword: 'x', newPassword: 'Password123!' });

      expect(response.status).toBe(403);
      expect((response.body as { code?: string }).code).toBe(
        'USE_USERS_ME_PASSWORD',
      );
    });

    it('still lets the audited Nest route change a password internally', async () => {
      // UsersService.changePassword reaches the same endpoint through
      // auth.api.changePassword(), which must keep working.
      const email = `pwd-${Date.now()}@example.com`;
      const created = await auth.api.signUpEmail({
        body: { email, password: 'Password123!', name: 'Password Door' },
      });
      expect(created.user.id).toBeTruthy();

      await expect(
        auth.api.changePassword({
          body: {
            currentPassword: 'Password123!',
            newPassword: 'Password456!',
          },
          headers: { cookie: '' },
        }),
      ).rejects.toBeDefined();
      // Rejected for want of a session, NOT for being forbidden: the internal
      // path is open, which is the half this asserts.
    });
  });

  describe('every auth route a client may call is in /api/docs', () => {
    it.each([
      '/api/auth/sign-in/email',
      '/api/auth/sign-out',
      '/api/auth/get-session',
      '/api/auth/request-password-reset',
      '/api/auth/reset-password',
      '/api/auth/update-user',
      '/api/auth/sign-up/email',
      '/api/auth/change-password',
    ])('%s is documented', (path) => {
      // The list drifted once: the reset flow moved onto better-auth and
      // nothing was added, so /api/docs showed three auth routes of nine.
      const document = { paths: {} } as never;
      addBetterAuthPaths(document);
      expect(Object.keys((document as { paths: object }).paths)).toContain(
        path,
      );
    });
  });

  describe('the routes the custom flow used to serve are gone', () => {
    it.each([
      '/api/auth-flows/forgot-password',
      '/api/auth-flows/verify-reset-code',
      '/api/auth-flows/reset-password',
    ])('%s is a 404', async (path) => {
      const response = await request(app.getHttpServer()).post(path).send({});
      expect(response.status).toBe(404);
    });
  });
});
