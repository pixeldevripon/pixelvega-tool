import { Injectable } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { ROLE_PERMISSIONS } from '@/config/roles.config';

/**
 * Resolves a caller's EFFECTIVE permission set. One source, consulted by
 * PermissionsGuard and by GET /users/me/permissions, so the two can never
 * disagree about what a session may do.
 *
 * Today the answer is the static ROLE_PERMISSIONS map: PixelVega has six fixed
 * roles and no per user grants. It is a service rather than a bare function so
 * that a future per user override, or a cache, has an obvious home and neither
 * the guard nor the controller has to change to get it.
 */
@Injectable()
export class PermissionsService {
  /** Every permission this user's role grants. */
  getEffectivePermissions(user: { role: Role }): Permission[] {
    return ROLE_PERMISSIONS[user.role] ?? [];
  }

  /** True when the user holds every one of `required`. */
  hasAll(
    user: { role: Role },
    required: Permission[],
  ): { granted: boolean; missing: Permission[] } {
    const effective = this.getEffectivePermissions(user);
    const missing = required.filter(
      (permission) => !effective.includes(permission),
    );
    return { granted: missing.length === 0, missing };
  }

  /** True when the user holds at least one of `candidates`. */
  hasAny(user: { role: Role }, candidates: Permission[]): boolean {
    const effective = this.getEffectivePermissions(user);
    return candidates.some((permission) => effective.includes(permission));
  }
}
