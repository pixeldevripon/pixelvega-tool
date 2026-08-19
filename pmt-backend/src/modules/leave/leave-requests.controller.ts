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
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { QueryLeaveSummaryDto } from './dto/query-leave-summary.dto';

const EMPLOYEE_ROLES = [
  Role.ADMIN,
  Role.PROJECT_MANAGER,
  Role.DEVELOPER,
  Role.DESIGNER,
];

@ApiTags('Leave Requests')
@ApiCookieAuth('better-auth.session_token')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @ApiOperation({
    summary: 'Request leave',
    description:
      'Always created as PENDING, even if it exceeds the remaining balance, balance is only checked at approval time. ADMIN and SYSTEM_ADMIN cannot submit a leave request, they only approve or reject one.',
  })
  @ApiResponse({ status: 201, description: 'Leave request created' })
  @ApiResponse({
    status: 403,
    description: 'Caller is ADMIN or SYSTEM_ADMIN',
  })
  @Roles(EMPLOYEE_ROLES)
  @Post()
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.leaveRequestsService.create(dto, user.id, user.role);
  }

  @ApiOperation({ summary: "Get the caller's own leave requests" })
  @ApiResponse({ status: 200, description: "Caller's leave requests" })
  @Roles(EMPLOYEE_ROLES)
  @Get('me')
  findOwn(@CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.findOwn(user.id);
  }

  @ApiOperation({
    summary: "Get the caller's own leave balance for the current year",
  })
  @ApiResponse({
    status: 200,
    description: "Caller's leave balance by leave type",
  })
  @Roles(EMPLOYEE_ROLES)
  @Get('me/balance')
  ownBalance(@CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.ownBalance(user.id);
  }

  @ApiOperation({
    summary: "Get a user's leave balance for the current year",
    description:
      'Shows allocated/used/remaining days per leave type for any user. ADMIN or PROJECT_MANAGER only.',
  })
  @ApiResponse({
    status: 200,
    description: "The user's leave balance by leave type",
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not ADMIN or PROJECT_MANAGER',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Roles([Role.ADMIN, Role.PROJECT_MANAGER])
  @Get(':userId/balance')
  balanceForUser(@Param('userId') userId: string) {
    return this.leaveRequestsService.balanceForUser(userId);
  }

  @ApiOperation({
    summary: 'Cancel own pending leave request',
    description:
      'Only the requester can cancel it, and only while it is still PENDING.',
  })
  @ApiResponse({ status: 200, description: 'Leave request cancelled' })
  @ApiResponse({ status: 403, description: 'Not your own leave request' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({
    status: 409,
    description: 'Leave request is no longer pending',
  })
  @Roles(EMPLOYEE_ROLES)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.cancel(id, user.id);
  }

  @ApiOperation({
    summary: 'List leave requests',
    description:
      'Paginated, newest first. Optionally filter to a single user via ?userId=. ADMIN sees every request regardless of status. PROJECT_MANAGER sees only PENDING and APPROVED requests — REJECTED is never returned to a PROJECT_MANAGER.',
  })
  @ApiResponse({ status: 200, description: 'Paginated leave requests' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not ADMIN or PROJECT_MANAGER',
  })
  @Roles([Role.ADMIN, Role.PROJECT_MANAGER])
  @Get()
  findAll(
    @CurrentUser() user: { role: Role },
    @Query() query: QueryLeaveRequestsDto,
  ) {
    return this.leaveRequestsService.findAll(user.role, query);
  }

  @ApiOperation({
    summary: 'Leave summary report',
    description:
      'For a date range (defaults to January 1 of the current year through today), totals how many approved leave days each person took, broken down by leave type. Filter to one or more roles or to a single user via userId. Add includeDetails=true to also see the exact dates behind the totals for each person. ADMIN only. Only APPROVED leave requests count, pending and rejected leave never appear here.',
  })
  @ApiResponse({
    status: 200,
    description: 'Per user leave totals by leave type, plus a grand total',
  })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @Roles([Role.ADMIN])
  @Get('summary')
  getSummary(@Query() query: QueryLeaveSummaryDto) {
    return this.leaveRequestsService.getSummary(query);
  }

  @ApiOperation({
    summary: 'Leave summary report, as a CSV file',
    description:
      'Same filters and totals as GET /leave-requests/summary, downloaded as a CSV file for Excel or Sheets instead of JSON. Without includeDetails this is a pivot table, one row per person with a column per leave type. With includeDetails it is one row per individual leave request instead, followed by a total row per person. ADMIN only.',
  })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @Roles([Role.ADMIN])
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

  @ApiOperation({ summary: 'Approve a pending leave request. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Leave request approved' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 409, description: 'Leave request already reviewed' })
  @Roles([Role.ADMIN])
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.leaveRequestsService.approve(id, user.id);
  }

  @ApiOperation({ summary: 'Reject a pending leave request. ADMIN only.' })
  @ApiResponse({ status: 200, description: 'Leave request rejected' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 409, description: 'Leave request already reviewed' })
  @Roles([Role.ADMIN])
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.leaveRequestsService.reject(id, dto, user.id);
  }
}
