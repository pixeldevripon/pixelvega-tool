import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import type { Permission } from '@prisma/client';
import { ANY_PERMISSIONS_KEY } from '@/auth/permissions/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '@/auth/permissions/require-permissions.decorator';

/** How a route is gated. */
export type RouteGate = 'ALL' | 'ANY' | 'PUBLIC' | 'UNGATED';

export interface RouteGating {
  /** e.g. `GET /projects/:id` */
  route: string;
  handler: string;
  gate: RouteGate;
  permissions: Permission[];
}

/**
 * The metadata key @thallesp/nestjs-better-auth's `@AllowAnonymous()` writes.
 * Read from the library's own source (`SetMetadata("PUBLIC", true)`) rather than
 * guessed, because a wrong key here would silently report every public route as
 * ungated and the coverage assertion would then be meaningless.
 */
const ALLOW_ANONYMOUS_KEY = 'PUBLIC';

/**
 * Read the permission gating off a controller class, from the metadata the
 * decorators actually wrote.
 *
 * This reads Reflect metadata rather than parsing source text. An earlier
 * text-parsing version of this got two things wrong that mattered: it attributed
 * the previous route's decorator when scanning backwards in the wrong order, and
 * it could not see a decorator that Prettier had wrapped across lines. Metadata
 * has neither problem, and it is what the guard itself reads at runtime.
 */
export function collectRouteGating(
  controller: new (...args: never[]) => object,
): RouteGating[] {
  const prototype = controller.prototype as Record<string, unknown>;
  const basePath =
    (Reflect.getMetadata(PATH_METADATA, controller) as string) ?? '';

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) =>
      Reflect.hasMetadata(METHOD_METADATA, prototype[name] as object),
    )
    .map((handler) => {
      const fn = prototype[handler] as object;
      const verb =
        RequestMethod[Reflect.getMetadata(METHOD_METADATA, fn) as number];
      const path = (Reflect.getMetadata(PATH_METADATA, fn) as string) ?? '';

      const all = Reflect.getMetadata(PERMISSIONS_KEY, fn) as
        Permission[] | undefined;
      const any = Reflect.getMetadata(ANY_PERMISSIONS_KEY, fn) as
        Permission[] | undefined;
      const anonymous = Reflect.getMetadata(ALLOW_ANONYMOUS_KEY, fn) === true;

      const gate: RouteGate = all?.length
        ? 'ALL'
        : any?.length
          ? 'ANY'
          : anonymous
            ? 'PUBLIC'
            : 'UNGATED';

      const joined =
        `/${basePath}/${path}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

      return {
        route: `${verb} ${joined}`,
        handler,
        gate,
        permissions: [...(all ?? any ?? [])].sort(),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}
