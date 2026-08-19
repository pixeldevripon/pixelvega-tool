import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AdditionalRequirementsService } from './additional-requirements.service';
import { CreateAdditionalRequirementDto } from '@/additional-requirements/dto/create-additional-requirement.dto';
import { ReviewAdditionalRequirementDto } from '@/additional-requirements/dto/review-additional-requirement.dto';
import { QueryAdditionalRequirementsDto } from '@/additional-requirements/dto/query-additional-requirements.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// Requirements received outside the normal project scope. Not visible to a
// client at all, unlike documents. Read access is any PM/ADMIN, or an
// active DEVELOPER/DESIGNER member of this specific project.

@ApiTags('Additional Requirements')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/additional-requirements')
export class AdditionalRequirementsController {
  constructor(
    private readonly additionalRequirementsService: AdditionalRequirementsService,
  ) {}

  @ApiOperation({
    summary: "List a project's additional requirements",
    description:
      'PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see every requirement. DEVELOPER/DESIGNER must be an active ProjectMember. Not visible to CLIENT.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated additional requirements',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.VIEW_ADDITIONAL_REQUIREMENTS)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryAdditionalRequirementsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.additionalRequirementsService.findAll(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({ summary: 'Get a single additional requirement' })
  @ApiResponse({ status: 200, description: 'The additional requirement' })
  @ApiResponse({
    status: 404,
    description: 'Project or additional requirement not found',
  })
  @RequirePermissions(Permission.VIEW_ADDITIONAL_REQUIREMENTS)
  @Get(':id')
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.additionalRequirementsService.findOne(
      projectId,
      id,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Log a requirement received outside the system',
    description:
      'Admin/System Admin/Project Manager only. A PROJECT_MANAGER caller must be actively staffed as PM on this specific project. Created as PENDING_REVIEW — use PATCH .../:id/review to approve or reject it.',
  })
  @ApiResponse({ status: 201, description: 'Additional requirement logged' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.CREATE_ADDITIONAL_REQUIREMENT)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAdditionalRequirementDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.additionalRequirementsService.create(
      projectId,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Approve or reject an additional requirement',
    description:
      "Admin/System Admin/Project Manager only. A PROJECT_MANAGER caller must be actively staffed as PM on this specific project. Can only be reviewed once — a requirement that's already APPROVED/REJECTED returns 409. Approving may additively increase estimatedHours and extend the deadline; approvedAdditionalHours/deadlineExtensionDays are rejected on a REJECTED decision.",
  })
  @ApiResponse({ status: 200, description: 'Additional requirement reviewed' })
  @ApiResponse({
    status: 400,
    description:
      'Sent approvedAdditionalHours/deadlineExtensionDays while rejecting',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or additional requirement not found',
  })
  @ApiResponse({ status: 409, description: 'Already reviewed' })
  @RequirePermissions(Permission.REVIEW_ADDITIONAL_REQUIREMENT)
  @Patch(':id/review')
  review(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: ReviewAdditionalRequirementDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.additionalRequirementsService.review(
      projectId,
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Check this requirement against the project scope, using Claude',
    description:
      "On demand only, never automatic. Admin/System Admin/Project Manager only, the PM caller must be actively staffed as PM on this specific project. Enqueues a CHECK_SCOPE job and returns its id, poll GET /ai-jobs/:id for the result. Callable regardless of the requirement's current status, calling it again just overwrites aiScopeAnalysis with a fresh result.",
  })
  @ApiResponse({ status: 202, description: 'Scope check enqueued' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or additional requirement not found',
  })
  @RequirePermissions(Permission.RUN_SCOPE_CHECK)
  @HttpCode(202)
  @Post(':id/check-scope')
  checkScope(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.additionalRequirementsService.checkScope(
      projectId,
      id,
      user.id,
      user.role,
    );
  }
}
