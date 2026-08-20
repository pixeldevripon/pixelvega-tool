import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { openAPI } from 'better-auth/plugins';
import { Role, UserStatus } from '@prisma/client';

import { authPrismaClient } from '@/auth/instance/auth-prisma.client';
import { parseCorsOrigins } from '@/common/utils/parse-cors-origins.util';
import { mailService } from '@/mail/mail.singleton';

// Re-exported so AuthModule can disconnect it on shutdown without importing
// the client file directly.
export { authPrismaClient };

/**
 * One hour, matching what the reset email says.
 *
 * Exported so the mail template is handed the same number rather than
 * hardcoding its own. A link that dies before the copy promises is the classic
 * failure here, and it is invisible until a user complains.
 */
export const RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Where better-auth is mounted, spelled once.
 *
 * Three places have to agree on it: this config, `AuthController`'s route, and
 * the body parser that must NOT consume the stream on these paths. better-auth
 * strips this prefix off the incoming URL before matching a route, so a
 * disagreement turns every auth route into a 404 rather than into an error
 * anyone would notice at boot.
 *
 * It includes the `api` global prefix because better-auth matches the full path.
 */
export const AUTH_BASE_PATH = '/api/auth';

/**
 * Where a reset link points.
 *
 * The token is minted by the API but redeemed by a page in the dashboard, so
 * the link has to leave this origin. It falls back to the first trusted origin
 * rather than to a hardcoded localhost, so a deployment that sets CORS_ORIGINS
 * correctly gets a correct reset link without a second variable to remember.
 */
const trustedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
const appUrl = process.env.APP_URL ?? trustedOrigins[0] ?? '';

/**
 * Fire and forget, with the rejection handled.
 *
 * These hooks deliberately do not await: a slow SMTP provider must not hold up
 * the response. But a bare floating promise that rejects is an unhandled
 * rejection, which terminates the process on modern Node, so every one is
 * caught and logged instead.
 */
const sendInBackground = (kind: string, promise: Promise<void>): void => {
  promise.catch((error) =>
    console.error(`[auth] ${kind} email failed to send:`, error),
  );
};

export const auth = betterAuth({
  appName: 'PixelVega PMT',

  basePath: AUTH_BASE_PATH,

  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(authPrismaClient, { provider: 'postgresql' }),

  // Read from CORS_ORIGINS, which env.validate.ts already parses and the HTTP
  // CORS layer already uses. Previously this was a hardcoded list containing a
  // third party domain and two ports the frontend does not run on.
  trustedOrigins,

  /**
   * The two rules this app adds to better-auth's own flows.
   *
   * They live here, inline, rather than in Nest provider classes. The provider
   * form needed an adapter package to discover them and graft them onto this
   * config at `onModuleInit()`, which meant the auth surface was only fully
   * assembled once Nest had booted, and a hook silently failed to attach if the
   * empty `hooks: {}` placeholder it grafted onto was ever removed. Inline, the
   * instance is complete the moment this module is evaluated, and there is
   * nothing to forget.
   *
   * The cost is no Nest DI, which is why they use `authPrismaClient` (the same
   * pre-DI client the adapter above uses) instead of `PrismaService`.
   */
  hooks: {
    before: createAuthMiddleware((ctx) => {
      if (ctx.path === '/sign-up/email') {
        refuseAnonymousSignUp(ctx);
      }
      if (ctx.path === '/sign-in/email') {
        return refuseSuspendedSignIn(ctx);
      }
      return Promise.resolve();
    }),

    after: createAuthMiddleware((ctx) => {
      if (ctx.path === '/sign-in/email') {
        return activateOnFirstSignIn(ctx);
      }
      if (ctx.path === '/change-password') {
        return recordPasswordChange(ctx);
      }
      return Promise.resolve();
    }),
  },

  emailAndPassword: {
    enabled: true,

    // ── There is no public sign-up ──────────────────────────────────────────
    // An anonymous caller must not be able to POST /api/auth/sign-up/email and
    // create a user choosing their own role in the request body: a stranger
    // could otherwise mint themselves a SYSTEM_ADMIN row.
    //
    // It is deliberately NOT closed with `disableSignUp: true`. better-auth
    // enforces that flag inside its sign-up handler with NO exemption for
    // server side `auth.api.signUpEmail()` calls, and both legitimate creation
    // paths go through exactly that endpoint: `UsersService.invite()` and
    // `SystemAdminBootstrapService`. Setting it broke account creation
    // entirely, including a fresh deployment's ability to create its first
    // admin, with "Email and password sign up is not enabled".
    //
    // `refuseAnonymousSignUp` in the `hooks.before` above closes the HTTP route
    // instead, refusing only requests that arrived over HTTP. Do not
    // reintroduce `disableSignUp` here.

    minPasswordLength: 8,
    // Never mint a session for a server-initiated sign-up (the invite flow).
    autoSignIn: false,

    resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
    // A reset means the password is presumed compromised, so every other
    // session for that account has to go with it.
    revokeSessionsOnPasswordReset: true,

    /**
     * An invited user's first password is temporary, and `mustResetPassword`
     * is what makes the dashboard insist they replace it. Completing a reset
     * satisfies that requirement, so the flag has to clear here too.
     *
     * A password can change two ways, and both have to clear it: through the
     * forgot-password flow (here) and through `/change-password` (the after
     * hook above). Missing either leaves a user prompted forever to change a
     * password they have just chosen.
     */
    onPasswordReset: async ({ user }) => {
      await authPrismaClient.user.update({
        where: { id: user.id },
        data: { mustResetPassword: false },
      });
    },

    sendResetPassword: ({ user, token }) => {
      // The token comes from the callback argument, NOT from parsing `url`.
      // better-auth builds `url` as `<baseURL>/reset-password/<token>?callbackURL=`,
      // so the token is a PATH SEGMENT and reading a `token` query param off it
      // returns null. Doing that shipped every reset email with an empty token
      // and no reset could ever complete.
      //
      // `url` is ignored entirely: it points back at this API, and the page that
      // collects the new password lives in the dashboard.
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

      sendInBackground(
        'password-reset',
        mailService.sendPasswordResetEmail(
          user.email,
          resetUrl,
          RESET_PASSWORD_TOKEN_TTL_SECONDS / 60,
        ),
      );
      return Promise.resolve();
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh a token older than a day
  },

  /**
   * better-auth's OWN rate limiter, which is the only thing protecting these
   * routes.
   *
   * `AuthController` carries `@SkipThrottle()`, so Nest's per-IP tiers
   * deliberately do not apply: they are sized for a dashboard page load, and
   * letting an unrelated burst count against sign-in would lock out a
   * legitimate user without making password guessing meaningfully harder.
   * These per-path rules are the defense that does. Until this block existed,
   * sign-in was completely unthrottled.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      // `/request-password-reset`, NOT `/forget-password`. The older spelling
      // is gone in better-auth 1.6: a rule naming it silently never matches,
      // which would leave password reset requests on the 100/min default.
      // Verified against the running app, which 404s the old path.
      '/request-password-reset': { window: 60, max: 5 },
      '/reset-password': { window: 60, max: 5 },
      '/change-password': { window: 60, max: 5 },
    },
  },

  user: {
    modelName: 'user',
    additionalFields: {
      // `input: false` on all three. It defaults to TRUE, which is what let a
      // caller choose their own role on sign-up. Even with sign-up disabled
      // these stay closed: they are assigned server side, by the invite flow
      // and by UsersService, and no request body has any business setting them.
      role: {
        type: 'string',
        required: true,
        defaultValue: Role.DEVELOPER,
        returned: true,
        input: false,
      },
      status: {
        type: 'string',
        required: true,
        defaultValue: UserStatus.INVITED,
        returned: true,
        input: false,
      },
      mustResetPassword: {
        type: 'boolean',
        required: false,
        defaultValue: true,
        returned: true,
        input: false,
      },
    },
  },

  /**
   * Defence in depth, below the API surface.
   *
   * `SignUpGuardHook` and `input: false` above already close the escalation
   * path. These hooks assume both could be wrong, and are the reason a future
   * config mistake is not immediately a privilege escalation.
   */
  databaseHooks: {
    user: {
      create: {
        before: (userData) => {
          const incoming = (userData as { role?: unknown }).role;

          // SYSTEM_ADMIN is bootstrapped once, on first boot, by
          // SystemAdminBootstrapService. Nothing creates a second one, ever.
          if (incoming === Role.SYSTEM_ADMIN) {
            throw new APIError('FORBIDDEN', {
              message: 'SYSTEM_ADMIN accounts cannot be created at runtime.',
            });
          }

          // Anything unrecognised falls back to the least privileged role
          // rather than being trusted through.
          const assignable: Role[] = Object.values(Role).filter(
            (role) => role !== Role.SYSTEM_ADMIN,
          );
          const role = assignable.includes(incoming as Role)
            ? (incoming as Role)
            : Role.DEVELOPER;

          return Promise.resolve({ data: { ...userData, role } });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // Refuse the session at the door for an account that should not have
          // one. The AuthGuard blocks API access anyway, but a suspended user
          // holding a valid session is a state worth never reaching.
          const user = await authPrismaClient.user.findUnique({
            where: { id: session.userId },
            select: { status: true, deletedAt: true },
          });
          if (user?.status === UserStatus.SUSPENDED || user?.deletedAt) {
            // Reached only after the password already verified, so naming the
            // reason leaks nothing to someone without the credential.
            throw new APIError('FORBIDDEN', {
              message: 'This account has been suspended.',
            });
          }
          return { data: session };
        },
      },
    },
  },

  /**
   * The plugin exists for ONE reason: `auth.api.generateOpenAPISchema()`.
   *
   * `AuthController` is one catch-all handler, so reflection can only ever see
   * `ALL /api/auth/*splat`, which documents nothing. Without this plugin the
   * only way to document the auth surface is to write every path out by hand,
   * which is what this replaced: a hand written list silently goes stale on the
   * next `better-auth` upgrade, and it already had, showing three routes of the
   * thirty the library registers.
   *
   * `disableDefaultReference` turns off the plugin's own Scalar UI at
   * `/api/auth/reference`. It pulls its bundle from a CDN, which the API's
   * `Content-Security-Policy` blocks anyway, and `/api/docs` is the one place
   * this project documents itself.
   */
  plugins: [openAPI({ disableDefaultReference: true })],

  advanced: {
    // Origin checking is CSRF protection. It was previously disabled for
    // everything except NODE_ENV === 'production', which meant a staging
    // deployment ran with none. It is now only relaxed when explicitly asked
    // for, which is a thing someone has to opt into for a local Postman
    // session rather than a side effect of not being production.
    disableOriginCheck: process.env.AUTH_DISABLE_ORIGIN_CHECK === 'true',
  },
});

/**
 * Was this call an HTTP request, or a server side `auth.api.*` call?
 *
 * `ctx.request` is present for the former and absent for the latter, and that
 * single distinction is what lets a route be closed to the internet while the
 * invite flow still uses it.
 */
const isHttpRequest = (ctx: { request?: unknown }): boolean =>
  Boolean(ctx.request);

/**
 * Closes `POST /api/auth/sign-up/email` to the outside world.
 *
 * An anonymous caller must not be able to create a user. The role escalation
 * this originally guarded is closed twice over regardless (`input: false` on
 * every additional field, plus the SYSTEM_ADMIN refusal in `databaseHooks`),
 * but an open sign-up route on an internal tool is wrong on its own terms.
 *
 * `UsersService.invite()` and `SystemAdminBootstrapService` both go through
 * this endpoint via `auth.api.signUpEmail()`, carry no `request`, and pass
 * straight through.
 */
function refuseAnonymousSignUp(ctx: { request?: unknown }): void {
  if (!isHttpRequest(ctx)) {
    return;
  }
  console.warn(
    '[auth] Refused an anonymous sign-up. Accounts are created by invitation.',
  );
  throw new APIError('FORBIDDEN', {
    message:
      'Public sign-up is disabled. An administrator creates accounts by invitation.',
    code: 'SIGN_UP_DISABLED',
  });
}

/**
 * Refuses a sign-in for a suspended account before the password is checked.
 *
 * `databaseHooks.session.create.before` also refuses it, one layer down. This
 * one exists for the message: the database hook fires after the credential has
 * already verified, so it cannot distinguish "wrong password" from "suspended",
 * and a suspended user retyping a correct password needs to be told which.
 */
async function refuseSuspendedSignIn(ctx: { body?: unknown }): Promise<void> {
  const email = (ctx.body as { email?: string } | undefined)?.email;
  if (!email) {
    return;
  }

  const user = await authPrismaClient.user.findUnique({
    where: { email },
    select: { status: true },
  });
  if (user?.status === UserStatus.SUSPENDED) {
    throw new APIError('FORBIDDEN', {
      message:
        'Your account has been suspended. Please contact an administrator.',
      code: 'ACCOUNT_SUSPENDED',
    });
  }
}

/**
 * An invited account becomes ACTIVE the first time it signs in.
 *
 * INVITED means "created, never used". Nothing else moves an account out of it,
 * so without this the status column would say INVITED for users who had been
 * working in the tool for months.
 */
async function activateOnFirstSignIn(ctx: {
  context: { newSession?: { user?: { id: string; status?: string } } };
}): Promise<void> {
  const user = ctx.context.newSession?.user;
  if (!user || user.status !== UserStatus.INVITED) {
    return;
  }

  await authPrismaClient.user.update({
    where: { id: user.id },
    data: { status: UserStatus.ACTIVE },
  });
  await writeAuditLog(user.id, 'user.activated');
}

/**
 * Clears `mustResetPassword` and writes the audit entry after a password change.
 *
 * This used to be a `PATCH /users/me/password` endpoint in the users module
 * that wrapped `auth.api.changePassword()` to do exactly these two things. That
 * left two doors onto one action with different security properties, because
 * better-auth's own `/change-password` stayed reachable and did neither. The
 * wrapper is gone and this hook does the work, so there is one door and it is
 * better-auth's.
 *
 * ── Why the response is inspected ──
 * An after hook runs whether the endpoint SUCCEEDED or FAILED: the dispatcher
 * catches the endpoint's error, puts it in `context.returned`, and then calls
 * the after hooks. `ctx.context.session` is already populated at that point by
 * the endpoint's own session middleware, so keying off the session alone
 * cleared the flag and wrote an audit row for a rejected change, including one
 * rejected for giving the WRONG current password. On success the endpoint
 * returns `{ user, token }`; on failure it returns an APIError with no `user`.
 */
async function recordPasswordChange(ctx: {
  context: { session?: { user?: { id: string } }; returned?: unknown };
}): Promise<void> {
  const userId = ctx.context.session?.user?.id;
  if (!userId || !succeeded(ctx.context.returned)) {
    return;
  }

  await authPrismaClient.user.update({
    where: { id: userId },
    data: { mustResetPassword: false },
  });
  await writeAuditLog(userId, 'user.password_changed');
}

/**
 * Did the endpoint return a result, or an error?
 *
 * The success shape carries a `user`; an APIError does not. Checking for what
 * success looks like, rather than for what failure looks like, means a new
 * error type in a future version is treated as failure by default.
 */
function succeeded(returned: unknown): boolean {
  return (
    typeof returned === 'object' &&
    returned !== null &&
    'user' in returned &&
    typeof (returned as { user?: unknown }).user === 'object'
  );
}

/**
 * Writes an audit row from outside Nest's DI container.
 *
 * `AuditLogService` is the right thing to use anywhere a module can inject it.
 * These hooks cannot, so they write the same row through the same client the
 * auth adapter uses. A failed audit write must not fail the action it is
 * recording, which is why it is logged rather than thrown.
 */
async function writeAuditLog(userId: string, action: string): Promise<void> {
  try {
    await authPrismaClient.auditLog.create({
      data: { userId, action, targetType: 'User', targetId: userId },
    });
  } catch (error) {
    console.error(`[auth] Failed to write the ${action} audit entry:`, error);
  }
}

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
