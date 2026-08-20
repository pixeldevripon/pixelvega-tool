import type { OpenAPIObject } from '@nestjs/swagger';
import type { BetterAuthOptions } from 'better-auth';

import { auth, AUTH_BASE_PATH } from '@/auth/instance/auth.instance';

/** Every auth route is grouped under this one tag in `/api/docs`. */
const AUTH_TAG = 'Auth';

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

/** Paths that exist only to serve the documentation itself. */
const INTERNAL_PATHS = new Set(['/open-api/generate-schema', '/reference']);

/**
 * Routes that answer, but answer 403 to any HTTP caller.
 *
 * Sign-up is reached internally through `auth.api.signUpEmail()` by the invite
 * flow and the first-boot bootstrap, so it cannot simply be removed from the
 * auth instance. `refuseAnonymousSignUp` in the auth instance's `hooks.before`
 * turns it down when the call arrived over HTTP.
 */
const CLOSED_ROUTES = new Set(['/sign-up/email']);

type PathItem = Record<string, unknown>;

/**
 * Merges better-auth's generated OpenAPI schema into the Nest document.
 *
 * better-auth mounts its handlers as raw middleware in `onModuleInit()`, before
 * Nest's routing exists, so `SwaggerModule.createDocument()` cannot discover a
 * single auth route by reflection. They have to be added afterwards.
 *
 * The schema is GENERATED, not written here. The version of this file that this
 * replaced spelled out every path by hand and had already drifted: it
 * documented three routes while the app answered thirty, because moving the
 * password flows onto better-auth never came back to update the list. A
 * generated schema cannot drift, and it picks up new routes on a library
 * upgrade for free.
 *
 * Requires the `openAPI()` plugin in `auth.instance.ts`. If that is ever made
 * conditional, `generateOpenAPISchema` disappears from `auth.api` and this
 * function skips rather than throwing at boot.
 */
export async function mergeBetterAuthSchema(
  document: OpenAPIObject,
): Promise<void> {
  if (typeof auth.api.generateOpenAPISchema !== 'function') {
    return;
  }

  let schema: Awaited<ReturnType<typeof auth.api.generateOpenAPISchema>>;
  try {
    schema = await auth.api.generateOpenAPISchema();
  } catch (error) {
    // A documentation gap must never stop the process from serving traffic.
    console.warn('Could not merge the better-auth OpenAPI schema:', error);
    return;
  }

  const hidden = hiddenRoutes();

  for (const [path, pathItem] of Object.entries(schema.paths ?? {})) {
    if (INTERNAL_PATHS.has(path) || hidden.has(path)) {
      continue;
    }

    const merged: PathItem = { ...(pathItem as PathItem) };

    for (const method of HTTP_METHODS) {
      const operation = merged[method] as Record<string, unknown> | undefined;
      if (operation) {
        operation.tags = [AUTH_TAG];
      }
    }

    document.paths[`${AUTH_BASE_PATH}${path}`] = merged;
  }

  const authSchemas = schema.components?.schemas;
  if (authSchemas) {
    document.components = document.components ?? {};
    document.components.schemas = {
      ...document.components.schemas,
      // better-auth types its generated schemas against its own field model,
      // which overlaps OpenAPI's SchemaObject without being assignable to it.
      // The values are valid OpenAPI at runtime; only the two libraries' type
      // definitions disagree.
      ...(authSchemas as unknown as NonNullable<
        NonNullable<OpenAPIObject['components']>['schemas']
      >),
    };
  }
}

/**
 * Routes better-auth registers that this deployment does not offer.
 *
 * The generated schema is the LIBRARY's full surface, not this app's. Published
 * verbatim it advertises social sign-in, email verification, account deletion
 * and email changes that are not configured, so a client developer would build
 * a Google button that cannot work. They are left out entirely.
 *
 * Derived from `auth.options` rather than hardcoded, so enabling a social
 * provider or a verification mailer makes the matching routes appear in
 * `/api/docs` in the same change that makes them work in the app. A hardcoded
 * list is what went stale last time.
 */
function hiddenRoutes(): Set<string> {
  // `auth.options` is typed as the literal object passed to `betterAuth()`, so
  // a key the config does not set is not on the type at all. Reading through
  // the library's own wide option type is what makes "is this configured" a
  // question that can be asked. Enabling a provider later still narrows to a
  // truthy value here, so the check keeps working.
  const options = auth.options as BetterAuthOptions;
  const hidden = new Set(CLOSED_ROUTES);

  const hide = (paths: string[]) => {
    for (const path of paths) {
      hidden.add(path);
    }
  };

  if (Object.keys(options.socialProviders ?? {}).length === 0) {
    hide([
      '/sign-in/social',
      '/link-social',
      '/unlink-account',
      '/callback/{id}',
      '/get-access-token',
      '/refresh-token',
      '/account-info',
      '/list-accounts',
    ]);
  }

  if (!options.emailVerification?.sendVerificationEmail) {
    hide(['/send-verification-email', '/verify-email']);
  }

  if (!options.user?.changeEmail?.enabled) {
    hide(['/change-email']);
  }

  if (!options.user?.deleteUser?.enabled) {
    hide(['/delete-user', '/delete-user/callback']);
  }

  return hidden;
}
