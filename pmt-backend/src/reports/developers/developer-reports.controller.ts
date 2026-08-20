import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DeveloperReportService } from '@/reports/developers/developer-report.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { ApiGetDeveloperReportDocs } from '@/reports/developers/developer-reports.swagger';
import { QueryDeveloperReportDto } from '@/reports/developers/dto/developer-report.dto';

// Not project-nested: one person's activity across every project they
// touched in the range, the same reason TimeEntriesController's
// project-summary/daily-summary endpoints aren't project-nested either.

@ApiTags('Developer Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('reports/developers')
export class DeveloperReportsController {
  constructor(
    private readonly developerReportService: DeveloperReportService,
  ) {}

  @ApiGetDeveloperReportDocs()
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
