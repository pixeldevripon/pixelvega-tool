/**
 * Every documented path parameter is the one the route actually takes.
 *
 * ADR 0004 renamed forty `:id` parameters for the entity each identifies, and
 * the `@ApiParam` declarations in the swagger files did not follow. Nothing
 * caught it: Nest matches path parameters by position, so every route kept
 * working, and Swagger published whatever name it was handed. `/api/docs` then
 * described a parameter called `id` on an operation whose real parameter is
 * `projectId`, which is the confusion the ADR was written to end.
 *
 * This is the check that makes the rename hold. It reads decorator metadata,
 * not source text, for the same reason `route-permissions.spec.ts` does.
 */

// Importing a controller pulls in its constructor parameter types at runtime,
// because emitDecoratorMetadata needs them, and that chain reaches better-auth,
// which ships ESM that Jest's CJS transform cannot parse. None of it is used
// here: this spec only reads decorator metadata off the classes.
jest.mock('better-auth/node', () => ({ fromNodeHeaders: jest.fn() }));
jest.mock('better-auth', () => ({
  betterAuth: jest.fn(() => ({ api: {} })),
  APIError: Error,
}));
jest.mock('@/auth/instance/auth.instance', () => ({ auth: { api: {} } }));

import 'reflect-metadata';
import { ALL_CONTROLLERS } from '@/app.controllers';
import { collectRouteParams } from '@/common/swagger/route-params.util';

const routes = ALL_CONTROLLERS.flatMap((controller) =>
  collectRouteParams(controller),
);

describe('documented path parameters', () => {
  it('covers every controller', () => {
    expect(ALL_CONTROLLERS).toHaveLength(29);
    expect(routes.length).toBeGreaterThan(100);
  });

  it('never documents a parameter the route does not have', () => {
    const wrong = routes
      .filter((route) =>
        route.documented.some((name) => !route.inPath.includes(name)),
      )
      .map((route) => ({
        route: route.route,
        documented: route.documented,
        inPath: route.inPath,
      }));

    expect(wrong).toEqual([]);
  });

  it('documents every parameter the route does have', () => {
    const missing = routes
      .filter((route) =>
        route.inPath.some((name) => !route.documented.includes(name)),
      )
      .map((route) => ({
        route: route.route,
        inPath: route.inPath,
        documented: route.documented,
      }));

    expect(missing).toEqual([]);
  });

  it('has no parameter called id anywhere, in a route or in its docs', () => {
    const bare = routes
      .filter(
        (route) =>
          route.inPath.includes('id') || route.documented.includes('id'),
      )
      .map((route) => route.route);

    expect(bare).toEqual([]);
  });
});
