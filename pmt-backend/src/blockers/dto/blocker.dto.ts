import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BlockerSeverity, BlockerStatus } from '@prisma/client';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import * as FieldLength from '@/common/constants/field-lengths';
import { Trim } from '@/common/decorators/trim.decorator';

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class BlockerUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;
}

export class BlockerProjectDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;
}

export class BlockerReasonResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Technical' })
  name!: string;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  updatedAt!: Date;
}

export class BlockerCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      'Whether this caller may edit the blocker at all. False once it is RESOLVED, which locks it permanently.',
  })
  canEdit!: boolean;

  @ApiProperty({
    example: true,
    description:
      'Whether the status may still move forward. Status is forward only: OPEN to IN_PROGRESS to RESOLVED.',
  })
  canChangeStatus!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether this caller may resolve the blocker now.',
  })
  canResolve!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether this caller may hand the blocker to someone else.',
  })
  canReassign!: boolean;
}

export class BlockerResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiPropertyOptional({ type: BlockerProjectDto })
  project?: BlockerProjectDto;

  @ApiProperty({ example: 'DB schema not approved, blocking all API work' })
  description!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({ type: EnumDisplayDto })
  severity!: EnumDisplayDto;

  @ApiProperty({ type: BlockerReasonResponseDto })
  reason!: BlockerReasonResponseDto;

  @ApiProperty({ type: BlockerUserDto })
  reportedBy!: BlockerUserDto;

  @ApiPropertyOptional({
    type: BlockerUserDto,
    nullable: true,
    description:
      'Who is currently working it. Distinct from reportedBy and resolvedBy, because ownership changes hands.',
  })
  assignedTo!: BlockerUserDto | null;

  @ApiPropertyOptional({ example: '2026-08-12T10:00:00.000Z', nullable: true })
  assignedAt!: Date | null;

  @ApiPropertyOptional({ type: BlockerUserDto, nullable: true })
  resolvedBy!: BlockerUserDto | null;

  @ApiPropertyOptional({ example: '2026-08-13T16:00:00.000Z', nullable: true })
  resolvedAt!: Date | null;

  @ApiPropertyOptional({
    example: 'PM approved schema, code updated',
    nullable: true,
  })
  resolutionNotes!: string | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description:
      "Days this blocker added to the project's deadline. Additive on top of the current deadline, never an absolute override.",
  })
  deadlineExtensionDays!: number | null;

  @ApiProperty({
    example: false,
    description:
      'Whether the blocker is resolved. Convenience for the status value.',
  })
  isResolved!: boolean;

  @ApiPropertyOptional({
    example: 1440,
    nullable: true,
    description:
      'Exact minutes from being reported to being resolved. Null while still open.',
  })
  resolutionMinutes!: number | null;

  @ApiPropertyOptional({
    example: '24h',
    nullable: true,
    description: 'The same figure ready to render.',
  })
  resolutionLabel!: string | null;

  @ApiProperty({
    example: 180,
    description:
      'Exact minutes the blocker has been open: to resolution if resolved, to now if not.',
  })
  ageMinutes!: number;

  @ApiProperty({ example: '3h' })
  ageLabel!: string;

  @ApiPropertyOptional({
    example: 0,
    nullable: true,
    description:
      'Whole days the blocker has been open. Null once resolved, because it has stopped ageing.',
  })
  daysOpen!: number | null;

  @ApiProperty({
    example: false,
    description:
      "Whether resolving this blocker pushed the project's deadline out. Answers 'what did blockers cost this project' without a client inspecting deadlineExtensionDays.",
  })
  causedDeadlineExtension!: boolean;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: BlockerCapabilitiesDto })
  capabilities!: BlockerCapabilitiesDto;
}

export class PaginatedBlockersResponseDto {
  @ApiProperty({ type: [BlockerResponseDto] })
  items!: BlockerResponseDto[];

  @ApiProperty({ example: 7 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

// Lists blockers across every project (GET /blockers). projectId narrows to
// one project on top of status/severity. Use QueryProjectBlockersDto for the
// dashboard nested under a project, where projectId is already in the route.
export class QueryBlockersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BlockerStatus })
  @IsOptional()
  @IsEnum(BlockerStatus)
  status?: BlockerStatus;

  @ApiPropertyOptional({ enum: BlockerSeverity })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filter to blockers assigned to this user.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class QueryProjectBlockersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BlockerStatus })
  @IsOptional()
  @IsEnum(BlockerStatus)
  status?: BlockerStatus;

  @ApiPropertyOptional({ enum: BlockerSeverity })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional({
    description: 'Filter to blockers assigned to this user.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

// Can be reported anytime, by anyone active on the project. It is completely
// independent of that day's DailyWorkReport.
export class AddBlockerDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'DB schema not approved, blocking all API work',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.LONG_TEXT)
  description!: string;

  @ApiPropertyOptional({
    enum: BlockerSeverity,
    default: BlockerSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Defaults to the "Unspecified" reason if omitted.',
  })
  @IsOptional()
  @IsUUID()
  reasonId?: string;
}

// All fields are optional. A caller can edit description/severity, move the
// status forward, reassign ownership, or any combination at once.
// resolutionNotes/deadlineExtensionDays are only meaningful alongside
// status: RESOLVED. Rejected outright once the blocker is already RESOLVED,
// since it's locked and read only at that point.
export class UpdateBlockerDto {
  @ApiPropertyOptional({ example: 'DB schema not approved (escalated)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.LONG_TEXT)
  description?: string;

  @ApiPropertyOptional({ enum: BlockerSeverity })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @ApiPropertyOptional({
    enum: BlockerStatus,
    description: 'Forward-only: OPEN -> IN_PROGRESS -> RESOLVED.',
  })
  @IsOptional()
  @IsEnum(BlockerStatus)
  status?: BlockerStatus;

  // User.id is a string generated by better-auth, not guaranteed to be a
  // UUID, so @IsUUID() would reject every real user id, same fix already
  // applied to AddProjectMemberDto.userId.
  @ApiPropertyOptional({
    example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg',
    description:
      'Who is now working the blocker. If omitted while moving status to IN_PROGRESS, the caller is auto-assigned. Must be an active member of the project.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.SINGLE_LINE)
  assignedToId?: string;

  @ApiPropertyOptional({
    example: 'PM approved schema, code updated',
    description: 'Required when status is RESOLVED.',
  })
  // Required by the trigger, and still type and length checked when
  // supplied anyway, which a bare trigger predicate would skip.
  @Trim()
  @ValidateIf(
    (o: Record<string, unknown>) =>
      o.status === BlockerStatus.RESOLVED || o.resolutionNotes !== undefined,
  )
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  @IsNotEmpty({
    message: 'resolutionNotes is required when resolving a blocker',
  })
  resolutionNotes?: string;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    description:
      "Days this blocker added to the project's deadline. Only valid when status is RESOLVED; added on top of the project's current deadline.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  deadlineExtensionDays?: number;
}

export class CreateBlockerReasonDto {
  @ApiProperty({ example: 'Technical' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.SHORT_TEXT)
  name!: string;
}

export class UpdateBlockerReasonDto {
  @ApiPropertyOptional({ example: 'Technical Issue' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.SHORT_TEXT)
  name?: string;
}
