import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DailyWorkReportService } from './daily-work-report.service';
import { DailyProjectEntryService } from './daily-project-entry.service';
import { SubmitPlanDto } from '@/work-reports/dto/submit-plan.dto';
import { UpdatePlanDto } from '@/work-reports/dto/update-plan.dto';
import { SubmitWrapUpDto } from '@/work-reports/dto/submit-wrap-up.dto';
import { UpdateWrapUpDto } from '@/work-reports/dto/update-wrap-up.dto';
import { ReviewEntryDto } from '@/work-reports/dto/review-entry.dto';
import { QueryDailyWorkReportsDto } from '@/work-reports/dto/query-daily-work-reports.dto';

const REPORT_AUTHOR_ROLES = [Role.DEVELOPER, Role.DESIGNER];
const REVIEWER_ROLES = [Role.PROJECT_MANAGER];
// Covers a DEVELOPER/DESIGNER viewing their own reports, plus PM/Admin
// looking up a specific team member. The actual gating lives in
// findAllForUser().
const LIST_ROLES = [Role.DEVELOPER, Role.DESIGNER, Role.PROJECT_MANAGER];

@ApiTags('Daily Work Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('daily-work-reports')
export class DailyWorkReportController {
  constructor(
    private readonly dailyWorkReportService: DailyWorkReportService,
    private readonly dailyProjectEntryService: DailyProjectEntryService,
  ) {}

  @ApiOperation({
    summary: "Submit today's plan",
    description:
      'Creates the daily work report for today with one entry per project. One per user per day — a second submission on the same day returns 409.',
  })
  @ApiResponse({ status: 201, description: 'Plan submitted' })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of one of the listed projects',
  })
  @ApiResponse({
    status: 409,
    description: 'A report already exists for today',
  })
  @Roles(REPORT_AUTHOR_ROLES)
  @Post()
  submitPlan(@Body() dto: SubmitPlanDto, @CurrentUser() user: { id: string }) {
    return this.dailyWorkReportService.create(user.id, dto);
  }

  @ApiOperation({
    summary: 'Update the plan',
    description:
      'Editable anytime until wrap-up is submitted — no time limit. Locked (409) once wrap-up has been submitted.',
  })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  @ApiResponse({
    status: 409,
    description: 'Plan locked after wrap-up submitted',
  })
  @Roles(REPORT_AUTHOR_ROLES)
  @Patch(':id/plan')
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.dailyWorkReportService.updatePlan(id, user.id, dto);
  }

  @ApiOperation({ summary: "Get today's report" })
  @ApiResponse({
    status: 200,
    description: "Today's report, or null if not started",
  })
  @Roles(REPORT_AUTHOR_ROLES)
  @Get('today')
  getTodayReport(@CurrentUser() user: { id: string }) {
    return this.dailyWorkReportService.findByUserAndDate(user.id, new Date());
  }

  @ApiOperation({
    summary: 'List daily work reports',
    description:
      "Defaults to the caller's own reports, across all their projects. DEVELOPER/DESIGNER may only view their own (403 if userId is set to someone else); PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass userId to view any team member. Omit startDate/endDate for all time, or set a range (both inclusive). Use type=PLAN or type=WRAP_UP to see only one kind of entry per report.",
  })
  @ApiResponse({ status: 200, description: 'Paginated daily work reports' })
  @ApiResponse({
    status: 403,
    description:
      "Attempted to view another user's reports without PM/Admin access",
  })
  @Roles(LIST_ROLES)
  @Get()
  findAll(
    @Query() query: QueryDailyWorkReportsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.dailyWorkReportService.findAllForUser(
      user.id,
      user.role,
      query,
    );
  }

  @ApiOperation({
    summary: 'Submit wrap-up',
    description:
      'Plan is mandatory first — 409 if the plan was never submitted for this report. Can include projects not in the original plan.',
  })
  @ApiResponse({ status: 201, description: 'Wrap-up submitted' })
  @ApiResponse({ status: 409, description: 'Plan not yet submitted' })
  @Roles(REPORT_AUTHOR_ROLES)
  @Post(':id/wrap-up')
  submitWrapUp(
    @Param('id') id: string,
    @Body() dto: SubmitWrapUpDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.dailyWorkReportService.submitWrapUp(id, user.id, dto);
  }

  @ApiOperation({
    summary: 'Update the wrap-up',
    description:
      'Editable for 2 hours after wrap-up submission. Locked (409) after that window.',
  })
  @ApiResponse({ status: 200, description: 'Wrap-up updated' })
  @ApiResponse({ status: 409, description: 'Wrap-up locked after 2 hours' })
  @Roles(REPORT_AUTHOR_ROLES)
  @Patch(':id/wrap-up')
  updateWrapUp(
    @Param('id') id: string,
    @Body() dto: UpdateWrapUpDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.dailyWorkReportService.updateWrapUp(id, user.id, dto);
  }

  @ApiOperation({
    summary: "Review a project entry's wrap-up",
    description:
      'Project Manager of that project (or Admin/System Admin) only. The entry must already have a submitted wrap-up.',
  })
  @ApiResponse({ status: 200, description: 'Entry reviewed' })
  @ApiResponse({ status: 403, description: 'Not the manager of this project' })
  @ApiResponse({
    status: 409,
    description: 'Wrap-up not yet submitted for this entry',
  })
  @Roles(REVIEWER_ROLES)
  @Patch(':reportId/entries/:entryId/review')
  reviewEntry(
    @Param('entryId') entryId: string,
    @Body() dto: ReviewEntryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.dailyProjectEntryService.review(
      entryId,
      dto,
      user.id,
      user.role,
    );
  }
}
