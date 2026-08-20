import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

/**
 * Where @nestjs/swagger stores every `@ApiParam`, `@ApiQuery` and `@ApiBody` it
 * was given for a handler. The package does not export its constants, so the
 * literal lives here beside the code that reads it, the same way
 * `IS_PUBLIC_KEY` carries better-auth's literal.
 */
const API_PARAMETERS = 'swagger/apiParameters';

interface SwaggerParameter {
  name?: string;
  in?: string;
}

export interface RouteParams {
  /** e.g. `PATCH /projects/:projectId` */
  route: string;
  handler: string;
  /** Parameter names the route itself declares, in path order. */
  inPath: string[];
  /** Parameter names `@ApiParam({ in: 'path' })` documents. */
  documented: string[];
}

/**
 * Read a controller's path parameters and the ones its Swagger decorators
 * document, from the metadata the decorators actually wrote.
 *
 * The two can disagree silently, and nothing else catches it: Nest matches on
 * position, so a route works whatever its parameter is called, and Swagger
 * publishes whatever name it was handed. ADR 0004 renamed forty path
 * parameters and left the `@ApiParam` declarations behind, so `/api/docs`
 * documented a parameter called `id` on an operation whose real parameter was
 * `projectId`. That is the exact confusion the ADR exists to remove.
 */
export function collectRouteParams(
  controller: new (...args: never[]) => object,
): RouteParams[] {
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

      const joined =
        `/${basePath}/${path}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

      const parameters =
        (Reflect.getMetadata(API_PARAMETERS, fn) as SwaggerParameter[]) ?? [];

      return {
        route: `${verb} ${joined}`,
        handler,
        inPath: pathParams(joined),
        documented: parameters
          .filter((parameter) => parameter.in === 'path')
          .map((parameter) => parameter.name ?? '')
          .sort(),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * `:name` tokens in a route, in order. Nest's optional (`:name?`) and wildcard
 * (`*splat`) forms are normalised away, since neither changes the name a client
 * or Swagger sees.
 */
function pathParams(route: string): string[] {
  return route
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1).replace(/\?$/, ''));
}
