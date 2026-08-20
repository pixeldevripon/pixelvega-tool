import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';

import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { CurrentSession } from '@/common/decorators/current-session.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiListOwnSessionsDocs,
  ApiRevokeOtherSessionsDocs,
  ApiRevokeOwnSessionDocs,
} from '@/profiles/sessions/profile-sessions.swagger';
import { ProfileSessionsService } from '@/profiles/sessions/profile-sessions.service';

/**
 * Routing only. Documentation lives in profile-sessions.swagger.ts.
 *
 * Mounted under `profiles/me/` rather than at a top level `/sessions`, because
 * every route here is about the caller and nobody else: there is no id in the
 * path naming whose sessions these are, and there must never be one. Two
 * segments after `profiles` also means these never collide with
 * `GET /profiles/:userId`, which matches a single segment.
 *
 * `others` is declared above `:sessionId`, or Nest matches it as a session id.
 */
@ApiTags('Profiles')
@ApiCookieAuth('better-auth.session_token')
@Controller('profiles/me/sessions')
export class ProfileSessionsController {
  constructor(private readonly sessionsService: ProfileSessionsService) {}

  @ApiListOwnSessionsDocs()
  @RequirePermissions(Permission.VIEW_OWN_SESSIONS)
  @Get()
  findMine(
    @CurrentUser() user: { id: string },
    @CurrentSession() session: { token: string },
  ) {
    return this.sessionsService.findMine(user.id, session.token);
  }

  @ApiRevokeOtherSessionsDocs()
  @RequirePermissions(Permission.MANAGE_OWN_SESSIONS)
  @Delete('others')
  revokeOthers(
    @CurrentUser() user: { id: string },
    @CurrentSession() session: { token: string },
  ) {
    return this.sessionsService.revokeOthers(user.id, session.token);
  }

  @ApiRevokeOwnSessionDocs()
  @RequirePermissions(Permission.MANAGE_OWN_SESSIONS)
  @Delete(':sessionId')
  revoke(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string },
    @CurrentSession() session: { token: string },
  ) {
    return this.sessionsService.revoke(user.id, sessionId, session.token);
  }
}
