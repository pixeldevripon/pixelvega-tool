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
