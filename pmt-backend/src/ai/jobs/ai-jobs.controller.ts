import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AiJobsService } from '@/ai/jobs/ai-jobs.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { ApiGetAiJobDocs } from '@/ai/jobs/ai-jobs.swagger';

// Generic across job types since a job is not necessarily project scoped
// from the caller's point of view, a client is usually just polling one
// specific job it already knows the id of. Access is checked per job
// inside AiJobsService, not a blanket role rule, ADMIN/SYSTEM_ADMIN are
// still auto unioned in by Roles() below for every other role.
@ApiTags('AI Jobs')
@ApiCookieAuth('better-auth.session_token')
@Controller('ai/jobs')
export class AiJobsController {
  constructor(private readonly aiJobsService: AiJobsService) {}

  @ApiGetAiJobDocs()
  @RequirePermissions(Permission.VIEW_AI_JOB)
  @Get(':jobId')
  findOne(
    @Param('jobId') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.aiJobsService.findOneScoped(id, user.id, user.role);
  }
}
