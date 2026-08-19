import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/**
 * Restricts a route to callers holding at least ONE of the listed permissions
 * (OR), unlike @RequirePermissions which demands all of them (AND).
 *
 * Why it exists: a route serving several audiences from one handler, where the
 * response is narrowed per caller in the service. Reading a project is the
 * case: a client, a staffed developer and a PM all reach the same route and
 * each gets a different projection.
 *
 * Both decorators may sit on one route; the guard then enforces both.
 *
 * @example
 *   @RequireAnyPermission(Permission.VIEW_ALL_PROJECTS, Permission.VIEW_OWN_PROJECTS)
 */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
