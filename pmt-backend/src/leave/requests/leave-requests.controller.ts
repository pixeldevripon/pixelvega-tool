import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { LeaveRequestsService } from '@/leave/requests/leave-requests.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiApproveLeaveDocs,
  ApiCancelOwnLeaveDocs,
  ApiGetOwnLeaveBalanceDocs,
  ApiGetUserLeaveBalanceDocs,
  ApiLeaveSummaryCsvDocs,
  ApiLeaveSummaryDocs,
  ApiListLeaveRequestsDocs,
  ApiListOwnLeaveDocs,
  ApiRejectLeaveDocs,
  ApiRequestLeaveDocs,
} from '@/leave/leave.swagger';
import {
  CreateLeaveRequestDto,
  QueryLeaveRequestsDto,
  QueryLeaveSummaryDto,
  RejectLeaveRequestDto,
} from '@/leave/dto/leave.dto';

@ApiTags('Leave Requests')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @ApiRequestLeaveDocs()
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @Post()
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.leaveRequestsService.create(dto, user.id, user.role);
  }

  @ApiListOwnLeaveDocs()
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @Get('me')
  findOwn(@CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.findOwn(user.id);
  }

  @ApiGetOwnLeaveBalanceDocs()
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @Get('me/balance')
  ownBalance(@CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.ownBalance(user.id);
  }

  @ApiGetUserLeaveBalanceDocs()
  @RequirePermissions(Permission.VIEW_LEAVE_REQUESTS)
  @Get(':userId/balance')
  balanceForUser(@Param('userId') userId: string) {
    return this.leaveRequestsService.balanceForUser(userId);
  }

  @ApiCancelOwnLeaveDocs()
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.cancel(id, user.id);
  }

  @ApiListLeaveRequestsDocs()
  @RequirePermissions(Permission.VIEW_LEAVE_REQUESTS)
  @Get()
  findAll(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: QueryLeaveRequestsDto,
  ) {
    return this.leaveRequestsService.findAll(user.role, query, user.id);
  }

  @ApiLeaveSummaryDocs()
  @RequirePermissions(Permission.VIEW_LEAVE_SUMMARY)
  @Get('summary')
  getSummary(@Query() query: QueryLeaveSummaryDto) {
    return this.leaveRequestsService.getSummary(query);
  }

  @ApiLeaveSummaryCsvDocs()
  @RequirePermissions(Permission.VIEW_LEAVE_SUMMARY)
  @Get('summary/export')
  async getSummaryCsv(
    @Query() query: QueryLeaveSummaryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, content } =
      await this.leaveRequestsService.getSummaryCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }

  @ApiApproveLeaveDocs()
  @RequirePermissions(Permission.REVIEW_LEAVE_REQUEST)
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.approve(id, user.id);
  }

  @ApiRejectLeaveDocs()
  @RequirePermissions(Permission.REVIEW_LEAVE_REQUEST)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.leaveRequestsService.reject(id, dto, user.id);
  }
}
