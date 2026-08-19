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
import { AiTemplatesService } from './ai-templates.service';
import { CreateAiTemplateDto } from '@/ai/dto/create-ai-template.dto';
import { UpdateAiTemplateDto } from '@/ai/dto/update-ai-template.dto';
import { QueryAiTemplatesDto } from '@/ai/dto/query-ai-templates.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  ApiCreateAiTemplateDocs,
  ApiDeleteAiTemplateDocs,
  ApiListAiTemplatesDocs,
  ApiUpdateAiTemplateDocs,
} from '@/ai/ai.swagger';

@ApiTags('AI Templates')
@ApiCookieAuth('better-auth.session_token')
@Controller('ai-templates')
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
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAiTemplateDto) {
    return this.aiTemplatesService.update(id, dto);
  }

  @ApiDeleteAiTemplateDocs()
  @RequirePermissions(Permission.MANAGE_AI_TEMPLATES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiTemplatesService.remove(id);
  }
}
