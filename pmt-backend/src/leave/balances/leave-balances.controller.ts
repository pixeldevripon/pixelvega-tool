import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';

import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiGetOwnLeaveBalanceDocs,
  ApiGetUserLeaveBalanceDocs,
} from '@/leave/leave.swagger';
import { LeaveRequestsService } from '@/leave/requests/leave-requests.service';

/**
 * A person's remaining leave, per type.
 *
 * Its own resource because it is a different ENTITY from a leave request, and
 * these two routes used to share the leave-requests id slot with them:
 * `PATCH /leave-requests/:id/approve` took a LeaveRequest id while
 * `GET /leave-requests/:userId/balance` took a User id. Same collection, same
 * position, two entity types, and passing the wrong one answered 404 with no
 * explanation. ADR 0004 rules that out.
 *
 * The logic stays in `LeaveRequestsService`: a balance is derived from approved
 * requests, so splitting the service would put one rule in two places.
 */
@ApiTags('Leave Balances')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave/balances')
export class LeaveBalancesController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // Static before dynamic: declared after `:userId`, Nest would match `me` as
  // a user id and answer 404 for the caller's own balance.
  @ApiGetOwnLeaveBalanceDocs()
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @Get('me')
  ownBalance(@CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.ownBalance(user.id);
  }

  @ApiGetUserLeaveBalanceDocs()
  @RequirePermissions(Permission.VIEW_LEAVE_REQUESTS)
  @Get(':userId')
  balanceForUser(@Param('userId') userId: string) {
    return this.leaveRequestsService.balanceForUser(userId);
  }
}
