import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiTemplateKind } from '@prisma/client';

const AI_TEMPLATE_KINDS = Object.values(AiTemplateKind);

export class CreateAiTemplateDto {
  @ApiProperty({ enum: AI_TEMPLATE_KINDS, example: 'PROJECT_SUMMARY' })
  @IsIn(AI_TEMPLATE_KINDS)
  kind!: AiTemplateKind;

  @ApiProperty({ example: 'Default project summary' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: '## Status\n...\n\n## Recent Progress\n...',
    description:
      'A structural outline, not the generated output itself. Goes directly into the system prompt as the required section structure.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Exactly one AiTemplate per kind can be the default at a time. Setting this to true on create unsets any existing default of the same kind.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
