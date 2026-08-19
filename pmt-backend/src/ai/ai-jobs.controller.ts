import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AiJobsService } from './ai-jobs.service';

// Generic across job types since a job is not necessarily project scoped
// from the caller's point of view, a client is usually just polling one
// specific job it already knows the id of. Access is checked per job
// inside AiJobsService, not a blanket role rule, ADMIN/SYSTEM_ADMIN are
// still auto unioned in by Roles() below for every other role.
@ApiTags('AI Jobs')
@ApiCookieAuth('better-auth.session_token')
@Controller('ai-jobs')
export class AiJobsController {
  constructor(private readonly aiJobsService: AiJobsService) {}

  @ApiOperation({
    summary: 'Get the status of a queued AI job',
    description:
      'Polls a CHECK_SCOPE or GENERATE_STATUS_REPORT job. Access is checked against whatever the underlying feature would have required, a Project Manager staffed on that specific project, plus the automatic Admin/System Admin.',
  })
  @ApiResponse({ status: 200, description: 'The job and its current status.' })
  @ApiResponse({ status: 403, description: 'Not allowed to view this job.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  @Roles([Role.PROJECT_MANAGER])
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.aiJobsService.findOneScoped(id, user.id, user.role);
  }
}
