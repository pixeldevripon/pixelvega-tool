import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { InternalReviewsService } from './internal-reviews.service';
import { CreateInternalReviewDto } from '@/internal-reviews/dto/create-internal-review.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// Not visible to CLIENT at all, matching Additional Requirements. This is
// an internal QA gate, not client facing.

@ApiTags('Internal Reviews')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/internal-reviews')
export class InternalReviewsController {
  constructor(
    private readonly internalReviewsService: InternalReviewsService,
  ) {}

  @ApiOperation({
    summary: "List a project's internal review history",
    description:
      'PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see every round. DEVELOPER/DESIGNER must be an active ProjectMember. Not visible to CLIENT. Ordered oldest round first.',
  })
  @ApiResponse({ status: 200, description: 'Paginated internal review rounds' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.VIEW_INTERNAL_REVIEWS)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.internalReviewsService.findAll(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Submit an internal review decision',
    description:
      'Admin/System Admin/Project Manager only. A PROJECT_MANAGER caller must be actively staffed as PM on this specific project, and the project must currently be INTERNAL_REVIEW. Creates a new ProjectInternalReview round and moves the project: APPROVED to READY_FOR_CLIENT, CHANGES_REQUIRED to READY_FOR_WORK. comments is required when requesting changes. This is the only way to make either transition. PATCH /projects/:id/status no longer allows them from INTERNAL_REVIEW.',
  })
  @ApiResponse({ status: 201, description: 'Internal review recorded' })
  @ApiResponse({
    status: 400,
    description: 'comments missing while requesting changes',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 409,
    description: 'Project is not currently in internal review',
  })
  @RequirePermissions(Permission.SUBMIT_INTERNAL_REVIEW)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateInternalReviewDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.internalReviewsService.create(
      projectId,
      dto,
      user.id,
      user.role,
    );
  }
}
