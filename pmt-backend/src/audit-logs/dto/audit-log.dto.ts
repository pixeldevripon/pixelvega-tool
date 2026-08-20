import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import * as FieldLength from '@/common/constants/field-lengths';

// ── Response DTOs ────────────────────────────────────────────────────────────

export class AuditLogActorDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'pm@pixelvega.com' })
  email!: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({
    example: 'user.updated',
    description:
      'Dot namespaced action. The vocabulary grows as features land; it is not a database enum. This is the exact value: filter and compare on it, never on the label.',
  })
  action!: string;

  @ApiProperty({
    example: 'User updated',
    description:
      'The action as a person reads it. Derived from the action rather than looked up, because the vocabulary is open: a lookup table would render a blank cell for whichever new action nobody remembered to add.',
  })
  actionLabel!: string;

  @ApiPropertyOptional({
    example: 'User',
    nullable: true,
    description:
      'The kind of record acted on. Nullable, because `LogEntry` does not require one: an action can be about the system rather than about a row. The DTO declared it required while the column allowed null, which is a promise the API could not keep.',
  })
  targetType!: string | null;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  targetId!: string | null;

  @ApiPropertyOptional({
    example: {
      changes: { role: { from: 'DEVELOPER', to: 'PROJECT_MANAGER' } },
    },
    nullable: true,
    description: 'Free form detail, shaped per action.',
  })
  metadata!: unknown;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
    description:
      'The ACTOR who performed the action, not necessarily the person it was done to. That is targetId.',
  })
  userId!: string | null;

  @ApiPropertyOptional({ type: AuditLogActorDto, nullable: true })
  user!: AuditLogActorDto | null;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  createdAt!: Date;
}

export class PaginatedAuditLogResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items!: AuditLogResponseDto[];

  @ApiProperty({ example: 842 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

// ── Query DTOs ───────────────────────────────────────────────────────────────

export class QueryAuditLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'User' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Id of the record acted on.' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Id of the user who PERFORMED the action, not the target.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({
    example: 'user.password_changed',
    description:
      'Exact action name. Audit actions are written as stable dotted strings by the code that emits them, so this is an equality match rather than a search: a partial match would silently include actions a reader did not mean to ask about.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  action?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'Inclusive, from the start of this day. An audit log without a date range is unusable at any real size: the question is almost always "what happened around then".',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'Inclusive, to the END of this day.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
