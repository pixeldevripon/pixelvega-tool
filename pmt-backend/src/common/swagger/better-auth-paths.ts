import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * better-auth's own routes are handled by raw middleware, not Nest controllers,
 * so SwaggerModule cannot discover them by reflection. Documented here by hand
 * so they show up alongside our own endpoints.
 *
 * This covers the whole auth surface, because the whole auth surface is
 * better-auth's: sign-in, sign-out, session lookup, and the three password
 * flows. The password flows used to be Nest controllers under `/auth-flows`, so
 * their `@ApiResponse` decorators documented them for free. Deleting that
 * controller took the endpoints out of `/api/docs` as well as out of the app,
 * which left a client integrating against the document with no documented way
 * to reset a password at all. Their entries are hand written here instead.
 *
 * Each password flow carries its own rate limit, set in
 * `auth/instance/auth.instance.ts` under `rateLimit.customRules`. Nest's
 * throttler cannot see these routes (the library mounts them ahead of the guard
 * pipeline), so the limit named in each description is the real one.
 */
export function addBetterAuthPaths(document: OpenAPIObject): void {
  document.paths['/api/auth/sign-in/email'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Log in with email + password',
      description:
        'Provided by better-auth. On success, sets the `better-auth.session_token` cookie.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' },
                rememberMe: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login succeeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  redirect: { type: 'boolean' },
                  token: { type: 'string' },
                  user: { type: 'object' },
                },
              },
            },
          },
        },
        '401': { description: 'Invalid email or password' },
      },
    },
  };

  document.paths['/api/auth/sign-out'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Log out and clear the session',
      description: 'Provided by better-auth.',
      security: [{ cookie: [] }],
      responses: {
        '200': { description: 'Signed out' },
      },
    },
  };

  document.paths['/api/auth/request-password-reset'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Start a password reset',
      description:
        'Provided by better-auth. Emails a link carrying a single use token, valid for one hour. ' +
        'Answers 200 whether or not the address belongs to an account: answering differently would ' +
        'turn this into an account enumeration oracle. Rate limited to 5 per minute. ' +
        'NOTE the path: better-auth 1.6 renamed this from /forget-password, which now 404s.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', format: 'email' },
                redirectTo: {
                  type: 'string',
                  description:
                    'Path in the dashboard the emailed link should land on.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Accepted, whether or not the account exists' },
        '429': { description: 'Rate limited' },
      },
    },
  };

  document.paths['/api/auth/reset-password'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Finish a password reset',
      description:
        'Provided by better-auth. Consumes the emailed token and revokes every other session for ' +
        'the account, because a reset means the old password is presumed compromised. ' +
        'Rate limited to 5 per minute.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newPassword', 'token'],
              properties: {
                newPassword: { type: 'string', minLength: 8 },
                token: {
                  type: 'string',
                  description: 'From the emailed link. Single use, one hour.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Password changed, other sessions revoked' },
        '400': { description: 'Token missing, expired or already used' },
        '429': { description: 'Rate limited' },
      },
    },
  };

  document.paths['/api/auth/update-user'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Update your own name or image',
      description:
        'Provided by better-auth. Session authenticated. It CANNOT change role, status or ' +
        'mustResetPassword: those are declared `input: false`, so better-auth rejects a request ' +
        'that supplies one. That is what stops this being a self promotion path, since this route ' +
        'is middleware and never reaches the permission guard.',
      security: [{ cookie: [] }],
      responses: {
        '200': { description: 'Updated' },
        '400': {
          description: 'A field that is not accepted from input was supplied',
        },
        '401': { description: 'No session' },
      },
    },
  };

  // Documented BECAUSE they are closed. A client developer who finds a 403 here
  // needs to know it is deliberate and where the real route is.
  document.paths['/api/auth/sign-up/email'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'CLOSED. There is no public sign-up',
      description:
        'Always 403 for an HTTP caller. Accounts are created by an administrator through ' +
        'POST /api/users/invite. The route exists because the invite flow itself calls it ' +
        'server side, where it is permitted.',
      responses: {
        '403': { description: 'SIGN_UP_DISABLED' },
      },
    },
  };

  document.paths['/api/auth/change-password'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'CLOSED. Use PATCH /api/users/me/password',
      description:
        'Always 403 for an HTTP caller. This route is middleware, so it is neither gated by ' +
        'CHANGE_OWN_PASSWORD nor audited. PATCH /api/users/me/password is both, and also clears ' +
        'mustResetPassword, so it is the only door.',
      responses: {
        '403': { description: 'USE_USERS_ME_PASSWORD' },
      },
    },
  };

  document.paths['/api/auth/get-session'] = {
    get: {
      tags: ['Better Auth (built-in)'],
      summary: 'Get the currently authenticated session/user',
      description: 'Provided by better-auth.',
      security: [{ cookie: [] }],
      responses: {
        '200': {
          description: 'Current session, or null if not authenticated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  session: { type: 'object', nullable: true },
                  // Carries the three fields this application adds on top of
                  // better-auth's user (see `auth/dto/auth.dto.ts`). The
                  // dashboard gates its forced password change on
                  // `mustResetPassword`.
                  user: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: {
                        type: 'string',
                        example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg',
                      },
                      email: {
                        type: 'string',
                        format: 'email',
                        example: 'rezina@pixelvega.com',
                      },
                      name: { type: 'string', example: 'Rezina Akter' },
                      role: { type: 'string', example: 'DEVELOPER' },
                      status: { type: 'string', example: 'ACTIVE' },
                      mustResetPassword: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  document.paths['/api/auth/request-password-reset'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Send a password reset link',
      description:
        'Provided by better-auth. Emails a single use link that expires after an hour. ' +
        'The answer is always 200 with the same message whether or not the address has ' +
        'an account, so this cannot be used to discover which addresses exist. ' +
        'Rate limited to 5 requests per minute. Note the path: the older ' +
        '`/forget-password` spelling was removed in better-auth 1.6 and now 404s.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'rezina@pixelvega.com',
                },
                redirectTo: {
                  type: 'string',
                  description:
                    'Where to land once the token is validated. Must be a trusted origin.',
                  example: '/reset-password',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Accepted, whether or not the address has an account',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example:
                      'If this email exists in our system, check your email for the reset link',
                  },
                },
              },
            },
          },
        },
        '429': { description: 'Rate limit exceeded (5 per minute)' },
      },
    },
  };

  document.paths['/api/auth/reset-password'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Set a new password using a reset token',
      description:
        'Provided by better-auth. The token comes from the emailed reset link and is ' +
        'single use: redeeming it consumes it. Every other session for the account is ' +
        'revoked on success, because a reset means the old password is presumed ' +
        'compromised. Rate limited to 5 requests per minute.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newPassword', 'token'],
              properties: {
                newPassword: {
                  type: 'string',
                  minLength: 8,
                  example: 'a-real-passphrase',
                },
                token: {
                  type: 'string',
                  description:
                    'From the reset link. May also be sent as a `token` query parameter.',
                  example: 'Kx8sT2mQ9vB4nR7wZ1aY3cE6',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Password replaced, and every other session revoked',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'boolean', example: true } },
              },
            },
          },
        },
        '400': {
          description:
            'Token missing, already used, or expired. Also returned when the new password is shorter than 8 characters',
        },
        '429': { description: 'Rate limit exceeded (5 per minute)' },
      },
    },
  };

  document.paths['/api/auth/change-password'] = {
    post: {
      tags: ['Better Auth (built-in)'],
      summary: 'Change your own password while signed in',
      description:
        'Provided by better-auth, and requires the current password. ' +
        'Prefer `PATCH /api/users/me/password`, which wraps this same call and ' +
        'additionally clears `mustResetPassword` and writes an audit log entry. ' +
        'Rate limited to 5 requests per minute.',
      security: [{ cookie: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: {
                currentPassword: { type: 'string' },
                newPassword: { type: 'string', minLength: 8 },
                revokeOtherSessions: {
                  type: 'boolean',
                  description:
                    'Sign every other device out. Defaults to false, which leaves them signed in.',
                  example: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Password changed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { user: { type: 'object' } },
              },
            },
          },
        },
        '400': { description: 'The current password did not match' },
        '401': { description: 'Not signed in' },
        '429': { description: 'Rate limit exceeded (5 per minute)' },
      },
    },
  };
}
