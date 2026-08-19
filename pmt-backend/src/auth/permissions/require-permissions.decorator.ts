import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a route to callers whose role grants ALL of the listed permissions.
 *
 * Dependencies: read by PermissionsGuard via PERMISSIONS_KEY, resolved against
 * ROLE_PERMISSIONS in src/config/roles.config.ts.
 *
 * This is the gate. Project scope is separate: a service level assertCanX()
 * helper decides whether this caller may act on this project.
 *
 * @example
 *   @RequirePermissions(Permission.CREATE_PROJECT)
 *   @RequirePermissions(Permission.EDIT_PROJECT, Permission.MANAGE_ESTIMATED_HOURS)
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
