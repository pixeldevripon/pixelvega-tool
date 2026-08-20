import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
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
      'Dot namespaced action. The vocabulary grows as features land; it is not a database enum.',
  })
  action!: string;

  @ApiProperty({
    example: 'User',
    description: 'The kind of record acted on.',
  })
  targetType!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  targetId!: string;

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
}
