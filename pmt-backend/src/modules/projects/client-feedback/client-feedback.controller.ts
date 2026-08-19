import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ClientFeedbackService } from './client-feedback.service';
import { CreateClientFeedbackDto } from './dto/create-client-feedback.dto';

// CLIENT can both read and submit here, unlike Internal Reviews (which
// excludes CLIENT entirely) — this is the client-facing half of that pair.
const READ_ROLES = [
  Role.PROJECT_MANAGER,
  Role.DEVELOPER,
  Role.DESIGNER,
  Role.CLIENT,
];
const WRITE_ROLES = [Role.PROJECT_MANAGER, Role.CLIENT];

@ApiTags('Client Feedback')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/client-feedback')
export class ClientFeedbackController {
  constructor(private readonly clientFeedbackService: ClientFeedbackService) {}

  @ApiOperation({
    summary: "List a project's client feedback history",
    description:
      "PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see every round. DEVELOPER/DESIGNER must be an active ProjectMember. CLIENT must be this project's own client. Ordered oldest round first.",
  })
  @ApiResponse({ status: 200, description: 'Paginated client feedback rounds' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @Roles(READ_ROLES)
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

  @ApiOperation({
    summary: 'Submit a client feedback decision',
    description:
      "Submitted by the project's own Client, or by a Project Manager staffed on this specific project recording feedback the Client gave outside the system. comments is required when requesting changes. Only the first round for a project requires the project to currently be WAITING_FOR_FEEDBACK and moves its status (APPROVED to COMPLETED, CHANGES_REQUESTED to READY_FOR_WORK); every later round is accepted regardless of the project's current status (blocked only once COMPLETED/CANCELLED) and never moves the status again.",
  })
  @ApiResponse({ status: 201, description: 'Client feedback recorded' })
  @ApiResponse({
    status: 400,
    description: 'comments missing while requesting changes',
  })
  @ApiResponse({
    status: 403,
    description:
      "Caller is not this project's client, or not staffed as PM on this project",
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 409,
    description:
      'First round submitted while the project is not WAITING_FOR_FEEDBACK, or the project is already COMPLETED/CANCELLED',
  })
  @Roles(WRITE_ROLES)
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
