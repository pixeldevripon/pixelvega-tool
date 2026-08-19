import { Roles as BetterAuthRoles } from '@thallesp/nestjs-better-auth';
import { Role } from '@prisma/client';

// SYSTEM_ADMIN and ADMIN can access every route gated by role, so neither
// has to be listed manually. This wraps the library's @Roles() and always
// unions them in.
const ALWAYS_ALLOWED_ROLES: Role[] = [Role.SYSTEM_ADMIN, Role.ADMIN];

export const Roles = (roles: Role[]) =>
  BetterAuthRoles([...new Set([...roles, ...ALWAYS_ALLOWED_ROLES])]);
