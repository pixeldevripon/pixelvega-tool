import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectAiSummaryService } from './project-ai-summary.service';
import { QueryProjectAiSummaryDto } from '@/ai-summary/dto/query-project-ai-summary.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('AI Project Summary')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/ai')
export class ProjectAiSummaryController {
  constructor(
    private readonly projectAiSummaryService: ProjectAiSummaryService,
  ) {}

  @ApiOperation({
    summary: "Generate a plain prose AI summary of this project's status",
    description:
      "Synchronous, no queue, generated fresh on every call, never stored. Attaches the project's PRD directly and combines it with everything reported as accomplishments (deliberately not plans) in the given date range, plus the open blocker count and core snapshot from the calculated Project Report. Same read scoping as the rest of this module: Project Manager, Admin, and System Admin can view any project; Developer and Designer only a project they are an active member of; Client is excluded. A project with no recent wrap ups still returns 200 with a thin summary, not an error.",
  })
  @ApiResponse({ status: 200, description: 'The generated summary.' })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of this project.',
  })
  @ApiResponse({ status: 404, description: 'Project not found.' })
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
