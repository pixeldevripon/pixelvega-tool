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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AiTemplatesService } from '@/ai/templates/ai-templates.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCreateAiTemplateDocs,
  ApiDeleteAiTemplateDocs,
  ApiListAiTemplatesDocs,
  ApiUpdateAiTemplateDocs,
} from '@/ai/ai.swagger';
import {
  CreateAiTemplateDto,
  QueryAiTemplatesDto,
  UpdateAiTemplateDto,
} from '@/ai/dto/ai.dto';

@ApiTags('AI Templates')
@ApiCookieAuth('better-auth.session_token')
@Controller('ai/templates')
export class AiTemplatesController {
  constructor(private readonly aiTemplatesService: AiTemplatesService) {}

  @ApiListAiTemplatesDocs()
  @RequirePermissions(Permission.VIEW_AI_TEMPLATES)
  @Get()
  findAll(@Query() query: QueryAiTemplatesDto) {
    return this.aiTemplatesService.findAll(query);
  }

  @ApiCreateAiTemplateDocs()
  @RequirePermissions(Permission.MANAGE_AI_TEMPLATES)
  @Post()
  create(
    @Body() dto: CreateAiTemplateDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.aiTemplatesService.create(dto, user.id);
  }

  @ApiUpdateAiTemplateDocs()
  @RequirePermissions(Permission.MANAGE_AI_TEMPLATES)
  @Patch(':templateId')
  update(@Param('templateId') id: string, @Body() dto: UpdateAiTemplateDto) {
    return this.aiTemplatesService.update(id, dto);
  }

  @ApiDeleteAiTemplateDocs()
  @RequirePermissions(Permission.MANAGE_AI_TEMPLATES)
  @Delete(':templateId')
  remove(@Param('templateId') id: string) {
    return this.aiTemplatesService.remove(id);
  }
}
