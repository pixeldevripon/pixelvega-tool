import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { InternalReviewsService } from './internal-reviews.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiListInternalReviewsDocs,
  ApiSubmitInternalReviewDocs,
} from '@/projects/reviews/internal/reviews.swagger';
import { CreateInternalReviewDto } from '@/projects/reviews/internal/dto/internal-review.dto';

// Not visible to CLIENT at all, matching Additional Requirements. This is
// an internal QA gate, not client facing.

@ApiTags('Internal Reviews')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/internal-reviews')
export class InternalReviewsController {
  constructor(
    private readonly internalReviewsService: InternalReviewsService,
  ) {}

  @ApiListInternalReviewsDocs()
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

  @ApiSubmitInternalReviewDocs()
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
