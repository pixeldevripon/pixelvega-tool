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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AdditionalRequirementsService } from './additional-requirements.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCheckRequirementScopeDocs,
  ApiCreateAdditionalRequirementDocs,
  ApiGetAdditionalRequirementDocs,
  ApiListAdditionalRequirementsDocs,
  ApiReviewAdditionalRequirementDocs,
} from '@/projects/reviews/internal/reviews.swagger';
import {
  CreateAdditionalRequirementDto,
  QueryAdditionalRequirementsDto,
  ReviewAdditionalRequirementDto,
} from '@/projects/requirements/additional/dto/additional-requirement.dto';

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

  @ApiListAdditionalRequirementsDocs()
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

  @ApiGetAdditionalRequirementDocs()
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

  @ApiCreateAdditionalRequirementDocs()
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

  @ApiReviewAdditionalRequirementDocs()
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

  @ApiCheckRequirementScopeDocs()
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
