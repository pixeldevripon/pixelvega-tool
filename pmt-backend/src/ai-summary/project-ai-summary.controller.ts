import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectAiSummaryService } from './project-ai-summary.service';
import { QueryProjectAiSummaryDto } from '@/ai-summary/dto/query-project-ai-summary.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ApiGetProjectAiSummaryDocs } from './project-ai-summary.swagger';

@ApiTags('AI Project Summary')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/ai')
export class ProjectAiSummaryController {
  constructor(
    private readonly projectAiSummaryService: ProjectAiSummaryService,
  ) {}

  @ApiGetProjectAiSummaryDocs()
  @RequirePermissions(Permission.REQUEST_AI_SUMMARY)
  @Get('summary')
  getSummary(
    @Param('projectId') projectId: string,
    @Query() query: QueryProjectAiSummaryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectAiSummaryService.getSummary(
      projectId,
      user.id,
      user.role,
      query,
    );
  }
}
