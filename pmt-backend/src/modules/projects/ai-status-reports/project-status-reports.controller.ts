import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ProjectStatusReportsService } from './project-status-reports.service';
import { CreateStatusReportDto } from './dto/create-status-report.dto';

const READ_ROLES = [Role.DEVELOPER, Role.DESIGNER, Role.PROJECT_MANAGER];

@ApiTags('AI Status Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/ai/status-reports')
export class ProjectStatusReportsController {
  constructor(
    private readonly projectStatusReportsService: ProjectStatusReportsService,
  ) {}

  @ApiOperation({
    summary: 'Generate a saved AI status report for this project, using Claude',
    description:
      "Asynchronous. Admin/System Admin/Project Manager only, a PROJECT_MANAGER caller must be actively staffed as PM on this specific project. periodStart/periodEnd are optional, defaulting to since this project's last status report, or the last seven days if it has never had one. Enqueues a GENERATE_STATUS_REPORT job and returns its id, poll GET /ai-jobs/:id for the result, resultRefId is the new ProjectStatusReport row's id once COMPLETED. Regenerating for the same or an overlapping period creates a new row rather than overwriting the last, the full history survives.",
  })
  @ApiResponse({
    status: 202,
    description: 'Status report generation enqueued',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @Roles([Role.PROJECT_MANAGER])
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

  @ApiOperation({
    summary: "List this project's AI status report history, newest first",
    description:
      'Same read scoping as GET /projects/:projectId/ai/summary: Project Manager, Admin, and System Admin can view any project; Developer and Designer only a project they are an active member of; Client is excluded.',
  })
  @ApiResponse({ status: 200, description: 'Status report history' })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @Roles(READ_ROLES)
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
