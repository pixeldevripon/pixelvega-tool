import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AiTemplateKind } from '@prisma/client';

const AI_TEMPLATE_KINDS = Object.values(AiTemplateKind);

export class QueryAiTemplatesDto {
  @ApiPropertyOptional({ enum: AI_TEMPLATE_KINDS, example: 'PROJECT_SUMMARY' })
  @IsOptional()
  @IsIn(AI_TEMPLATE_KINDS)
  kind?: AiTemplateKind;
}
