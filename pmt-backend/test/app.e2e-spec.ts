import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './create-test-app';

/**
 * Smoke tests for the global request pipeline. These assert the wiring every
 * other E2E spec depends on: the api prefix, the global AuthGuard, and that
 * better-auth is mounted at the literal path it is configured with.
 *
 * They deliberately make no authenticated call. Signing in belongs in the
 * feature specs, and this file must stay runnable against an empty database.
 */
describe('Global request pipeline (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('global prefix', () => {
    it('serves application routes under /api', async () => {
      // 401 rather than 404 is the point: the route resolved, and the global
      // AuthGuard rejected it. A 404 here would mean the prefix is wrong.
      const res = await request(app.getHttpServer()).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('does not serve the same route without the prefix', async () => {
      const res = await request(app.getHttpServer()).get('/users/me');
      expect(res.status).toBe(404);
    });
  });

  describe('global AuthGuard', () => {
    it('rejects an unauthenticated request to a protected route', async () => {
      const res = await request(app.getHttpServer()).get('/api/projects');
      expect(res.status).toBe(401);
    });

    it('rejects a request carrying a malformed session cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Cookie', 'better-auth.session_token=not-a-real-token');
      expect(res.status).toBe(401);
    });
  });

  describe('better-auth mounting', () => {
    // basePath is set to the literal '/api/auth' in auth.instance.ts, because
    // the library mounts its middleware in onModuleInit(), before
    // setGlobalPrefix runs. If someone "simplifies" that to '/auth' expecting
    // the prefix to compose, this test is what catches it.
    it('answers get-session at /api/auth with no session', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/auth/get-session',
      );
      expect(res.status).toBe(200);
      expect(res.body?.session ?? null).toBeNull();
    });
  });

  describe('unknown routes', () => {
    it('returns 404 through the global exception filter', async () => {
      const res = await request(app.getHttpServer()).get('/api/does-not-exist');
      expect(res.status).toBe(404);
      // The filter's stable envelope, so a client never has to branch on
      // which layer produced the error.
      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path', '/api/does-not-exist');
      expect(res.body).toHaveProperty('message');
    });
  });
});
