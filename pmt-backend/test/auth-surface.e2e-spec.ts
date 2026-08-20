/**
 * The auth surface, asserted against the running app.
 *
 * This file began as a probe. Before it, `POST /api/auth/sign-up/email` was
 * open to anyone and the caller chose their own `role` in the request body, so
 * a stranger could create themselves a SYSTEM_ADMIN row. Verified against the
 * real app, then fixed; these are the tests that keep it fixed.
 */
import { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { auth } from '@/auth/instance/auth.instance';
import { SENSITIVE_AUTH_MAX_PER_MINUTE } from '@/auth/instance/rate-limit.config';
import { mergeBetterAuthSchema } from '@/common/swagger/better-auth-schema';
import { mailService } from '@/mail/mail.singleton';
import { PrismaService } from '@/prisma/prisma.service';
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
  });

  describe('better-auth serves the only password change', () => {
    // There used to be two doors: this one, and a PATCH /users/me/password
    // wrapper in the users module. The wrapper existed because it did two
    // things this route did not, clear `mustResetPassword` and write an audit
    // entry, which left one action with two different security properties.
    // The wrapper is gone and an after hook does those two things here.
    //
    // NOTE ON ORDER: better-auth rate limits /change-password to 5/min per IP,
    // and every test in this block shares 127.0.0.1. The cases below are
    // written to spend exactly four, then the last case deliberately spends the
    // rest to prove the limiter is real. Adding a case here means accounting
    // for its request.
    const email = `change-pwd-${Date.now()}@pixelvega.test`;
    const firstPassword = 'Password123!';
    const secondPassword = 'Password456!';
    // better-auth refuses a cookie-authenticated state change with no Origin
    // header (`MISSING_OR_NULL_ORIGIN`). That is its CSRF protection, so the
    // browser's header has to be simulated. It must be a trusted origin:
    // CORS_ORIGINS in .env.test.
    const origin = 'http://localhost:3000';
    let userId: string;
    let cookie: string;

    const changePassword = (currentPassword: string, newPassword: string) =>
      request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Origin', origin)
        .set('Cookie', cookie)
        .send({ currentPassword, newPassword });

    beforeAll(async () => {
      const created = await auth.api.signUpEmail({
        body: { email, password: firstPassword, name: 'Password Door' },
      });
      userId = created.user.id;

      const prisma = app.get(PrismaService);
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', mustResetPassword: true },
      });

      const signIn = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email, password: firstPassword })
        .expect(200);
      cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
      expect(cookie).toContain('better-auth');
    });

    afterAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    });

    // Request 1.
    it('refuses a change without a session', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Origin', origin)
        .send({ currentPassword: firstPassword, newPassword: secondPassword });

      expect(response.status).toBe(401);
    });

    // Request 2.
    it('refuses a change with no Origin header, session or not', async () => {
      // CSRF protection. Without it, a form on any site could POST the
      // browser's session cookie here and change the password.
      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: firstPassword, newPassword: secondPassword });

      expect(response.status).toBe(403);
      expect((response.body as { code?: string }).code).toBe(
        'MISSING_OR_NULL_ORIGIN',
      );
    });

    // Request 3.
    it('refuses the wrong current password, and writes nothing', async () => {
      // An after hook runs on failure too: the dispatcher catches the
      // endpoint's error and then calls the after hooks. A hook keyed only off
      // the session cleared mustResetPassword and wrote an audit row for a
      // change that had just been refused.
      const prisma = app.get(PrismaService);

      const response = await changePassword('wrong', secondPassword);
      expect(response.status).toBe(400);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mustResetPassword: true },
      });
      expect(user.mustResetPassword).toBe(true);
      expect(
        await prisma.auditLog.count({
          where: { userId, action: 'user.password_changed' },
        }),
      ).toBe(0);
    });

    // Request 4.
    it('changes the password, clears mustResetPassword, and audits it', async () => {
      const prisma = app.get(PrismaService);

      await changePassword(firstPassword, secondPassword).expect(200);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mustResetPassword: true },
      });
      expect(after.mustResetPassword).toBe(false);

      const audit = await prisma.auditLog.findMany({
        where: { userId, action: 'user.password_changed' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0].targetId).toBe(userId);

      // The new password is the one that works now.
      await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email, password: secondPassword })
        .expect(200);
    });

    // Last on purpose: it deliberately exhausts the bucket every case above
    // shares, so anything after it would be throttled rather than tested.
    it('rate limits repeated attempts', async () => {
      // Nest's throttler deliberately does not cover /api/auth (the controller
      // carries @SkipThrottle()), so better-auth's own per-path limiter is the
      // only thing standing between this route and unlimited guessing.
      //
      // Driven from the CONFIGURED limit, not from a literal. This assertion was
      // written against the default of five and then failed the moment a
      // developer raised the knob in their own `.env`, which is a test breaking
      // on a supported configuration rather than on a defect. `.env.test` pins
      // the value so the count stays small; reading it here means the two can
      // never disagree again.
      //
      // The cases above have already spent some of the bucket, so the loop runs
      // a full limit's worth of attempts on top of them.
      let sawTooManyRequests = false;
      for (
        let attempt = 0;
        attempt < SENSITIVE_AUTH_MAX_PER_MINUTE + 1 && !sawTooManyRequests;
        attempt += 1
      ) {
        const response = await changePassword('wrong-again', 'Whatever123!');
        sawTooManyRequests = response.status === 429;
      }
      expect(sawTooManyRequests).toBe(true);
    });
  });

  describe('an invite sends a link, never a password', () => {
    // The invite used to email a temporary password: a working credential in an
    // inbox, in plain text, with no expiry. It now emails the same one time
    // token the reset flow uses, and the account has no usable password until
    // that link is followed.
    const email = `invite-${Date.now()}@pixelvega.test`;
    let userId: string;
    let invites: { to: string; url: string; minutes: number }[] = [];
    let resets: string[] = [];
    let realInvite: typeof mailService.sendInviteEmail;
    let realReset: typeof mailService.sendPasswordResetEmail;

    beforeEach(() => {
      invites = [];
      resets = [];
      realInvite = mailService.sendInviteEmail.bind(mailService);
      realReset = mailService.sendPasswordResetEmail.bind(mailService);
      mailService.sendInviteEmail = (to, _name, url, minutes) => {
        invites.push({ to, url, minutes });
        return Promise.resolve();
      };
      mailService.sendPasswordResetEmail = (_to, url) => {
        resets.push(url);
        return Promise.resolve();
      };
    });

    afterEach(async () => {
      mailService.sendInviteEmail = realInvite;
      mailService.sendPasswordResetEmail = realReset;
      if (userId) {
        const prisma = app.get(PrismaService);
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.session.deleteMany({ where: { userId } });
        await prisma.account.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
        userId = '';
      }
    });

    it('emails a set-password link, and the token works', async () => {
      const prisma = app.get(PrismaService);
      const created = await auth.api.signUpEmail({
        body: { email, password: 'a-password-nobody-is-told', name: 'Invitee' },
      });
      userId = created.user.id;

      // No headers: a server side reset is what marks this an invite rather
      // than a forgot-password.
      await auth.api.requestPasswordReset({ body: { email } });
      await new Promise((resolve) => setImmediate(resolve));

      expect(resets).toEqual([]);
      expect(invites).toHaveLength(1);
      expect(invites[0].to).toBe(email);
      expect(invites[0].minutes).toBe(60);

      const link = new URL(invites[0].url);
      expect(link.pathname).toBe('/set-password');
      const token = link.searchParams.get('token');
      expect(token).toBeTruthy();

      // The token is a real one: it sets a password that then signs in.
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'the-chosen-password-1' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email, password: 'the-chosen-password-1' })
        .expect(200);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mustResetPassword: true },
      });
      expect(after.mustResetPassword).toBe(false);
    });

    it('sends the reset copy, not the invite copy, for a real forgot-password', async () => {
      const created = await auth.api.signUpEmail({
        body: { email, password: 'a-password-nobody-is-told', name: 'Invitee' },
      });
      userId = created.user.id;

      // Over HTTP this time, which is what a genuine forgot-password is.
      await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email })
        .expect(200);
      await new Promise((resolve) => setImmediate(resolve));

      expect(invites).toEqual([]);
      expect(resets).toHaveLength(1);
      expect(new URL(resets[0]).pathname).toBe('/reset-password');
    });
  });

  describe('every auth route is in /api/docs', () => {
    // Built once: generating the schema walks every registered endpoint.
    let paths: Record<string, unknown>;

    beforeAll(async () => {
      const document = { paths: {} } as never as OpenAPIObject;
      await mergeBetterAuthSchema(document);
      paths = document.paths;
    });

    it.each([
      '/api/auth/sign-in/email',
      '/api/auth/sign-out',
      '/api/auth/get-session',
      '/api/auth/request-password-reset',
      '/api/auth/reset-password',
      '/api/auth/update-user',
      '/api/auth/change-password',
    ])('%s is documented', (path) => {
      expect(Object.keys(paths)).toContain(path);
    });

    it('documents the whole surface, not a hand written subset', () => {
      // The hand written list this replaced drifted to three of nine. The
      // number here is a floor, not an exact count: a better-auth upgrade
      // adding a route should not fail the suite, but losing the plugin
      // (and with it every auth path) must.
      expect(Object.keys(paths).length).toBeGreaterThanOrEqual(8);
      expect(
        Object.keys(paths).every((path) => path.startsWith('/api/auth/')),
      ).toBe(true);
    });

    it.each([
      // Closed to HTTP callers by a hook.
      '/api/auth/sign-up/email',
      // Registered by the library, but not configured here. Publishing them
      // would advertise a Google button and an email-verification flow that
      // cannot work.
      '/api/auth/sign-in/social',
      '/api/auth/link-social',
      '/api/auth/callback/{id}',
      '/api/auth/verify-email',
      '/api/auth/send-verification-email',
      '/api/auth/change-email',
      '/api/auth/delete-user',
    ])('%s is not documented', (path) => {
      expect(Object.keys(paths)).not.toContain(path);
    });

    it('does not document the schema endpoint that produced it', () => {
      expect(Object.keys(paths)).not.toContain(
        '/api/auth/open-api/generate-schema',
      );
    });
  });

  describe('the reset link actually carries a token', () => {
    // This is the test that was missing. `sendResetPassword` used to read the
    // token off `url`'s query string, but better-auth puts it in the PATH
    // (`/reset-password/<token>?callbackURL=`), so every email shipped
    // `?token=` with nothing after it and no reset could complete. The old
    // suite only ever asked for a reset on an address that does not exist,
    // which returns before the callback runs.
    const email = `reset-probe-${Date.now()}@pixelvega.test`;
    let userId: string;
    // A hand rolled stub rather than jest.spyOn: this suite runs under
    // --experimental-vm-modules, where the `jest` global is not injected.
    let sentResetUrls: string[] = [];
    let sentTo: string[] = [];
    let realSend: typeof mailService.sendPasswordResetEmail;

    beforeAll(async () => {
      const prisma = app.get(PrismaService);
      const created = await prisma.user.create({
        data: {
          email,
          name: 'Reset Probe',
          role: 'DEVELOPER',
          status: 'ACTIVE',
          mustResetPassword: true,
        },
        select: { id: true },
      });
      userId = created.id;
    });

    afterAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.user.delete({ where: { id: userId } });
    });

    beforeEach(() => {
      sentResetUrls = [];
      sentTo = [];
      realSend = mailService.sendPasswordResetEmail.bind(mailService);
      mailService.sendPasswordResetEmail = (to, resetUrl) => {
        sentTo.push(to);
        sentResetUrls.push(resetUrl);
        return Promise.resolve();
      };
    });

    afterEach(() => {
      mailService.sendPasswordResetEmail = realSend;
    });

    it('emails a link whose token is not empty', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email })
        .expect(200);

      // The send is fire and forget, so give the microtask queue a turn.
      await new Promise((resolve) => setImmediate(resolve));

      expect(sentTo).toEqual([email]);

      const token = new URL(sentResetUrls[0]).searchParams.get('token');
      expect(token).toBeTruthy();
      expect(String(token).length).toBeGreaterThan(16);
    });

    it('clears mustResetPassword once the reset completes', async () => {
      // An invited user's first password is temporary and `mustResetPassword`
      // is the flag that makes the dashboard insist on a replacement. It used
      // to be cleared in exactly one place, the `PATCH /users/me/password`
      // wrapper, so anyone who arrived through forgot-password kept the flag
      // forever and was nagged to change a password they had just chosen.
      const prisma = app.get(PrismaService);

      await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email })
        .expect(200);
      await new Promise((resolve) => setImmediate(resolve));

      const token = new URL(sentResetUrls[0]).searchParams.get('token');
      expect(token).toBeTruthy();

      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mustResetPassword: true },
      });
      expect(before.mustResetPassword).toBe(true);

      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'a-brand-new-password-1' })
        .expect(200);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mustResetPassword: true },
      });
      expect(after.mustResetPassword).toBe(false);
    });

    it('points the link at the dashboard, not back at this API', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email })
        .expect(200);
      await new Promise((resolve) => setImmediate(resolve));

      expect(new URL(sentResetUrls[0]).pathname).toBe('/reset-password');
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
