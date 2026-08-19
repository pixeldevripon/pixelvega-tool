import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Role } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AiTemplatesService } from './ai-templates.service';
import { CreateAiTemplateDto } from '@/ai/dto/create-ai-template.dto';
import { UpdateAiTemplateDto } from '@/ai/dto/update-ai-template.dto';
import { QueryAiTemplatesDto } from '@/ai/dto/query-ai-templates.dto';

const READ_ROLES = [Role.DEVELOPER, Role.DESIGNER, Role.PROJECT_MANAGER];
const WRITE_ROLES = [Role.ADMIN];

@ApiTags('AI Templates')
@ApiCookieAuth('better-auth.session_token')
@Controller('ai-templates')
export class AiTemplatesController {
  constructor(private readonly aiTemplatesService: AiTemplatesService) {}

  @ApiOperation({
    summary: 'List AI templates',
    description: 'Any staff role. Optionally filter by kind.',
  })
  @ApiResponse({ status: 200, description: 'AI templates' })
  @Roles(READ_ROLES)
  @Get()
  findAll(@Query() query: QueryAiTemplatesDto) {
    return this.aiTemplatesService.findAll(query);
  }

  @ApiOperation({
    summary: 'Create an AI template. Admin/System Admin only.',
    description:
      'Setting isDefault to true unsets any existing default of the same kind.',
  })
  @ApiResponse({ status: 201, description: 'AI template created' })
  @ApiResponse({ status: 403, description: 'Caller is not Admin' })
  @Roles(WRITE_ROLES)
  @Post()
  create(
    @Body() dto: CreateAiTemplateDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.aiTemplatesService.create(dto, user.id);
  }

  @ApiOperation({
    summary: 'Update an AI template. Admin/System Admin only.',
  })
  @ApiResponse({ status: 200, description: 'AI template updated' })
  @ApiResponse({ status: 403, description: 'Caller is not Admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @Roles(WRITE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAiTemplateDto) {
    return this.aiTemplatesService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Delete an AI template. Admin/System Admin only.',
    description:
      'Hard delete. Deleting the current default of a kind leaves that kind with no default until a new one is created.',
  })
  @ApiResponse({ status: 200, description: 'AI template deleted' })
  @ApiResponse({ status: 403, description: 'Caller is not Admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @Roles(WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiTemplatesService.remove(id);
  }
}
