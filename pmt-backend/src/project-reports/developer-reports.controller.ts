import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DeveloperReportService } from './developer-report.service';
import { QueryDeveloperReportDto } from '@/project-reports/dto/query-developer-report.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// Not project-nested: one person's activity across every project they
// touched in the range, the same reason TimeEntriesController's
// project-summary/daily-summary endpoints aren't project-nested either.

@ApiTags('Developer Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('reports/developer')
export class DeveloperReportsController {
  constructor(
    private readonly developerReportService: DeveloperReportService,
  ) {}

  @ApiOperation({
    summary: 'Get a calculated activity report for one person',
    description:
      'Plain aggregated numbers over a date range: hours worked (project and meeting), daily plan/wrap up compliance, blockers touched, leave taken, and projects worked on. No AI involved. Developer/Designer can only view their own; Project Manager, Admin, and System Admin may pass userId to view anyone.',
  })
  @ApiResponse({
    status: 200,
    description: 'The calculated developer report for the given range.',
  })
  @ApiResponse({
    status: 403,
    description: 'Not allowed to view this user’s report.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @RequirePermissions(Permission.VIEW_DEVELOPER_REPORTS)
  @Get()
  getReport(
    @Query() query: QueryDeveloperReportDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.developerReportService.getDeveloperReport(
      user.id,
      user.role,
      query,
    );
  }
}
