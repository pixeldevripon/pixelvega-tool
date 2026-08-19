/**
 * Every route in the codebase must declare a permission, or explicitly opt out
 * of authentication (directive D2).
 *
 * This spec reads the controller sources rather than the compiled metadata, so
 * it catches a new route the moment it is written, before it can be deployed
 * reachable by anyone with a session. A route with neither decorator is not a
 * deliberate choice, it is an omission.
 *
 * If this fails, add one of:
 *   @RequirePermissions(Permission.X)   the route needs a capability
 *   @RequireAnyPermission(A, B)         several audiences, narrowed in the service
 *   @AllowAnonymous()                   genuinely public, e.g. password reset
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'node:fs';

const SRC = join(__dirname, '..');
const HTTP_METHOD = /@(Get|Post|Patch|Put|Delete)\(/;
const GATE =
  /@(RequirePermissions|RequireAnyPermission|AllowAnonymous|Public)\(/;
const HANDLER = /^\s+(?:async\s+)?([a-zA-Z][a-zA-Z0-9]*)\s*\(/;

interface Route {
  file: string;
  handler: string;
  gated: boolean;
  gate: string | null;
}

/** Parse every controller and report each route with the gate above it. */
function collectRoutes(): Route[] {
  const files = globSync('**/*.controller.ts', { cwd: SRC }).sort();
  const routes: Route[] = [];

  for (const relative of files) {
    const lines = readFileSync(join(SRC, relative), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (!HTTP_METHOD.test(lines[i])) continue;

      // Decorators sit in one contiguous block above the handler. Walk back
      // over it until a line that is not a decorator or its continuation.
      let gate: string | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const line = lines[j].trim();
        if (
          line === '' ||
          line === '}' ||
          line.startsWith('*') ||
          line.startsWith('/')
        ) {
          if (line.startsWith('*') || line.startsWith('/')) continue;
          break;
        }
        const match = GATE.exec(lines[j]);
        if (match) {
          gate = match[1];
          break;
        }
      }
      // Decorators may also appear BELOW the HTTP verb, before the handler.
      let handler = '?';
      for (let k = i + 1; k < Math.min(i + 12, lines.length); k++) {
        const match = GATE.exec(lines[k]);
        if (match && !gate) gate = match[1];
        const h = HANDLER.exec(lines[k]);
        if (h && !['FilesInterceptor', 'FileInterceptor'].includes(h[1])) {
          handler = h[1];
          break;
        }
      }

      routes.push({ file: relative, handler, gated: gate !== null, gate });
    }
  }
  return routes;
}

describe('route permission coverage', () => {
  const routes = collectRoutes();

  it('finds every route in the codebase', () => {
    // A sanity check on the parser itself: if this drops to a handful, the
    // regexes stopped matching and the coverage assertion below is vacuous.
    expect(routes.length).toBeGreaterThan(100);
  });

  it('gates EVERY route with a permission or an explicit anonymous opt out', () => {
    const ungated = routes
      .filter((route) => !route.gated)
      .map((route) => `${route.file} -> ${route.handler}`);

    expect(ungated).toEqual([]);
  });

  it('keeps the anonymous surface small and deliberate', () => {
    // Every publicly reachable route, listed. Adding one should be a conscious
    // act that updates this list, not something that slips through review.
    const anonymous = routes
      .filter(
        (route) => route.gate === 'AllowAnonymous' || route.gate === 'Public',
      )
      .map((route) => `${route.file} -> ${route.handler}`)
      .sort();

    expect(anonymous).toEqual([
      'auth/auth.controller.ts -> forgotPassword',
      'auth/auth.controller.ts -> resetPassword',
      'auth/auth.controller.ts -> verifyResetCode',
    ]);
  });
});
