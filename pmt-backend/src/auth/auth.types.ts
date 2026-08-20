import type { Role, UserStatus } from '@prisma/client';
import type { Request } from 'express';

import type { AuthSession, AuthUser } from '@/auth/instance/auth.instance';

/**
 * The session user, with `role` and `status` typed as the Prisma enums.
 *
 * better-auth types its `additionalFields` as plain strings because it has no
 * knowledge of the database enums behind them. Every value at runtime is a
 * valid enum member: the columns are the enum types, and all three fields are
 * `input: false`, so a request body cannot put anything else there.
 */
export type TypedAuthUser = Omit<AuthUser, 'role' | 'status'> & {
  role: Role;
  status: UserStatus;
};

/** A request after `AuthGuard` has resolved the session. */
export interface AuthenticatedRequest extends Request {
  user?: TypedAuthUser;
  session?: AuthSession['session'];
}
