import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ClientFeedbackService } from './client-feedback.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiListClientFeedbackDocs,
  ApiSubmitClientFeedbackDocs,
} from '@/internal-reviews/reviews.swagger';
import { CreateClientFeedbackDto } from '@/client-feedback/dto/client-feedback.dto';

// CLIENT can both read and submit here, unlike Internal Reviews (which
// excludes CLIENT entirely) — this is the client-facing half of that pair.

@ApiTags('Client Feedback')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/client-feedback')
export class ClientFeedbackController {
  constructor(private readonly clientFeedbackService: ClientFeedbackService) {}

  @ApiListClientFeedbackDocs()
  @RequirePermissions(Permission.VIEW_CLIENT_FEEDBACK)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.clientFeedbackService.findAll(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiSubmitClientFeedbackDocs()
  @RequirePermissions(Permission.SUBMIT_CLIENT_FEEDBACK)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateClientFeedbackDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.clientFeedbackService.create(
      projectId,
      dto,
      user.id,
      user.role,
    );
  }
}
