import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectStatusReportsService } from './project-status-reports.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiGenerateStatusReportDocs,
  ApiListStatusReportsDocs,
} from '@/projects/ai/status-reports/project-status-reports.swagger';
import { CreateStatusReportDto } from '@/projects/ai/status-reports/dto/project-status-report.dto';

@ApiTags('AI Status Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/ai/status-reports')
export class ProjectStatusReportsController {
  constructor(
    private readonly projectStatusReportsService: ProjectStatusReportsService,
  ) {}

  @ApiGenerateStatusReportDocs()
  @RequirePermissions(Permission.GENERATE_STATUS_REPORT)
  @HttpCode(202)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateStatusReportDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectStatusReportsService.create(
      projectId,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiListStatusReportsDocs()
  @RequirePermissions(Permission.VIEW_STATUS_REPORTS)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectStatusReportsService.findAll(
      projectId,
      user.id,
      user.role,
    );
  }
}
