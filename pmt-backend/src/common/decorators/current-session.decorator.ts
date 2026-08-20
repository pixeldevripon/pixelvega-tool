import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from '@/auth/auth.types';

/**
 * The session `AuthGuard` resolved, as distinct from the user on it.
 *
 * Only one screen needs this: the Security tab has to know WHICH of the
 * caller's sessions made the request, so it can mark it current and refuse to
 * revoke it from a row. `@CurrentUser()` cannot answer that, because every
 * session belongs to the same user.
 *
 * The token is a bearer credential. It is used here to compare against stored
 * rows and never reaches a response.
 */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>().session;
  },
);
