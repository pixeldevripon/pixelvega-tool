import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * better-auth's own routes (login, sign-out, session lookup) are handled by raw
 * middleware, not Nest controllers, so SwaggerModule can't discover them by
 * reflection. Documented here by hand so they show up alongside our own endpoints.
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
                  user: { type: 'object', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  };
}
