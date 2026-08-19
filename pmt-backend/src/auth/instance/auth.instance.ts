import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
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

  // Set literally, NOT composed from the global prefix: the library mounts its
  // middleware in onModuleInit(), which runs before main.ts calls
  // setGlobalPrefix('api').
  basePath: '/api/auth',

  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(authPrismaClient, { provider: 'postgresql' }),

  // Read from CORS_ORIGINS, which env.validate.ts already parses and the HTTP
  // CORS layer already uses. Previously this was a hardcoded list containing a
  // third party domain and two ports the frontend does not run on.
  trustedOrigins,

  // Required for @thallesp/nestjs-better-auth's @Hook()/@AfterHook() providers
  // to attach. Removing it makes them throw at startup.
  hooks: {},

  emailAndPassword: {
    enabled: true,

    // ── There is no public sign-up ──────────────────────────────────────────
    // Every account is created by an admin through the invite flow
    // (UsersService.invite). Leaving this open let an anonymous caller POST to
    // /api/auth/sign-up/email and create a user, choosing their own role in
    // the request body: a stranger could mint themselves a SYSTEM_ADMIN row.
    // Verified against the running app before this line existed.
    disableSignUp: true,

    minPasswordLength: 8,
    // Never mint a session for a server-initiated sign-up (the invite flow).
    autoSignIn: false,

    resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
    // A reset means the password is presumed compromised, so every other
    // session for that account has to go with it.
    revokeSessionsOnPasswordReset: true,

    sendResetPassword: ({ user, url }) => {
      // better-auth's `url` points back at this API. The page that collects the
      // new password lives in the dashboard, so the token is forwarded there.
      const token = new URL(url).searchParams.get('token') ?? '';
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
   * Nest's ThrottlerGuard does not cover them: the library mounts its handlers
   * as middleware in `onModuleInit()`, before Nest's guard pipeline, so an
   * APP_GUARD never runs for `/api/auth/*`. Until this block existed, sign-in
   * was completely unthrottled and open to unlimited password guessing.
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
   * `disableSignUp` and `input: false` above already close the escalation path.
   * These hooks assume both could be wrong, and are the reason a future config
   * mistake is not immediately a privilege escalation.
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

  advanced: {
    // Origin checking is CSRF protection. It was previously disabled for
    // everything except NODE_ENV === 'production', which meant a staging
    // deployment ran with none. It is now only relaxed when explicitly asked
    // for, which is a thing someone has to opt into for a local Postman
    // session rather than a side effect of not being production.
    disableOriginCheck: process.env.AUTH_DISABLE_ORIGIN_CHECK === 'true',
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
