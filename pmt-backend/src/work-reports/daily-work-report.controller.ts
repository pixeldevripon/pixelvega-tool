import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DailyWorkReportService } from './daily-work-report.service';
import { DailyProjectEntryService } from './daily-project-entry.service';
import { SubmitPlanDto } from '@/work-reports/dto/submit-plan.dto';
import { UpdatePlanDto } from '@/work-reports/dto/update-plan.dto';
import { SubmitWrapUpDto } from '@/work-reports/dto/submit-wrap-up.dto';
import { UpdateWrapUpDto } from '@/work-reports/dto/update-wrap-up.dto';
import { ReviewEntryDto } from '@/work-reports/dto/review-entry.dto';
import { QueryDailyWorkReportsDto } from '@/work-reports/dto/query-daily-work-reports.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  ApiGetTodayReportDocs,
  ApiListWorkReportsDocs,
  ApiReviewWorkReportEntryDocs,
  ApiSubmitPlanDocs,
  ApiSubmitWrapUpDocs,
  ApiUpdatePlanDocs,
  ApiUpdateWrapUpDocs,
} from '@/work-reports/work-reports.swagger';

// Covers a DEVELOPER/DESIGNER viewing their own reports, plus PM/Admin
// looking up a specific team member. The actual gating lives in
// findAllForUser().

@ApiTags('Daily Work Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('daily-work-reports')
export class DailyWorkReportController {
  constructor(
    private readonly dailyWorkReportService: DailyWorkReportService,
    private readonly dailyProjectEntryService: DailyProjectEntryService,
  ) {}

  @ApiSubmitPlanDocs()
  @RequirePermissions(Permission.SUBMIT_WORK_REPORT)
  @Post()
  submitPlan(@Body() dto: SubmitPlanDto, @CurrentUser() user: { id: string }) {
    return this.dailyWorkReportService.create(user.id, dto);
  }

  @ApiUpdatePlanDocs()
  @RequirePermissions(Permission.SUBMIT_WORK_REPORT)
  @Patch(':id/plan')
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.dailyWorkReportService.updatePlan(id, user.id, dto);
  }

  @ApiGetTodayReportDocs()
  @RequirePermissions(Permission.SUBMIT_WORK_REPORT)
  @Get('today')
  getTodayReport(@CurrentUser() user: { id: string }) {
    return this.dailyWorkReportService.findByUserAndDate(user.id, new Date());
  }

  @ApiListWorkReportsDocs()
  @RequirePermissions(Permission.VIEW_WORK_REPORTS)
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

  @ApiSubmitWrapUpDocs()
  @RequirePermissions(Permission.SUBMIT_WORK_REPORT)
  @Post(':id/wrap-up')
  submitWrapUp(
    @Param('id') id: string,
    @Body() dto: SubmitWrapUpDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.dailyWorkReportService.submitWrapUp(id, user.id, dto);
  }

  @ApiUpdateWrapUpDocs()
  @RequirePermissions(Permission.SUBMIT_WORK_REPORT)
  @Patch(':id/wrap-up')
  updateWrapUp(
    @Param('id') id: string,
    @Body() dto: UpdateWrapUpDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.dailyWorkReportService.updateWrapUp(id, user.id, dto);
  }

  @ApiReviewWorkReportEntryDocs()
  @RequirePermissions(Permission.REVIEW_WORK_REPORT)
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
