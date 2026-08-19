import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { AiTemplateKind } from '@prisma/client';

import { EnumDisplayDto } from '@/common/dto/display.dto';
import * as FieldLength from '@/common/constants/field-lengths';

const AI_TEMPLATE_KINDS = Object.values(AiTemplateKind);

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class AiTemplateResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ type: EnumDisplayDto })
  kind!: EnumDisplayDto;

  @ApiProperty({ example: 'Default project summary' })
  name!: string;

  @ApiProperty({
    example: '## Status\n...\n\n## Recent Progress\n...',
    description: 'A structural outline, not generated output.',
  })
  content!: string;

  @ApiProperty({
    example: true,
    description: 'Exactly one template per kind is the default at a time.',
  })
  isDefault!: boolean;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  createdById!: string;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * A queued AI job.
 *
 * `input` and the result are deliberately opaque: their shape belongs to the
 * job type, not to this contract, and pinning them here would make every new
 * job type a breaking change.
 */
export class AiJobResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ type: EnumDisplayDto })
  type!: EnumDisplayDto;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  projectId!: string | null;

  @ApiPropertyOptional({
    example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg',
    nullable: true,
  })
  requestedById!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Whatever the job type needs. Opaque to this contract.',
  })
  input!: unknown;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
    description: 'The id of whatever the job produced, once it has finished.',
  })
  resultRefId!: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Present only on a FAILED job. Safe to show a user verbatim.',
  })
  errorMessage!: string | null;

  @ApiPropertyOptional({ example: '2026-08-12T09:00:05.000Z', nullable: true })
  startedAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-08-12T09:00:31.000Z', nullable: true })
  finishedAt!: Date | null;

  @ApiProperty({
    example: false,
    description:
      'Whether the job has reached a terminal state, either COMPLETED or FAILED. What a client polls on.',
  })
  isFinished!: boolean;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  createdAt!: Date;
}

/** What an enqueue returns: the id to poll. */
export class QueuedJobResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  jobId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryAiTemplatesDto {
  @ApiPropertyOptional({
    enum: AI_TEMPLATE_KINDS,
    example: AiTemplateKind.PROJECT_SUMMARY,
  })
  @IsOptional()
  @IsEnum(AiTemplateKind)
  kind?: AiTemplateKind;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class CreateAiTemplateDto {
  @ApiProperty({
    enum: AI_TEMPLATE_KINDS,
    example: AiTemplateKind.PROJECT_SUMMARY,
  })
  @IsEnum(AiTemplateKind)
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
  @MaxLength(FieldLength.DOCUMENT_TEXT)
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

// kind is deliberately not editable: changing what a template is for is a
// new template, not an edit of an existing one.
export class UpdateAiTemplateDto {
  @ApiPropertyOptional({ example: 'Default project summary (revised)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'A structural outline, not the generated output itself.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.DOCUMENT_TEXT)
  content?: string;

  @ApiPropertyOptional({
    description:
      'Setting this to true unsets any existing default of the same kind. Setting it to false just un-defaults this one, another can be set separately.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
