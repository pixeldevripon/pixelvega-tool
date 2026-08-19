import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';

const DAILY_ENTRY_TYPES = ['PLAN', 'WRAP_UP'] as const;
export type DailyEntryTypeFilter = (typeof DAILY_ENTRY_TYPES)[number];

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class WorkReportUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;
}

export class WorkReportProjectDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;
}

export class DailyProjectEntryCapabilitiesDto {
  @ApiProperty({
    example: false,
    description:
      "Whether this caller may leave a review comment on this entry. A reviewer is never the entry's own author.",
  })
  canReview!: boolean;
}

/** One project's line within a day's report. */
export class DailyProjectEntryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  dailyWorkReportId!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiPropertyOptional({ type: WorkReportProjectDto })
  project?: WorkReportProjectDto;

  @ApiPropertyOptional({
    example: 'Finish auth module\n- Wire up refresh tokens',
    nullable: true,
    description:
      "The morning intention. Null when the day's wrap up added this project.",
  })
  plan!: string | null;

  @ApiPropertyOptional({
    example: 'Completed auth module\n- Unit tests passing',
    nullable: true,
    description: 'The evening result. Null until a wrap up is submitted.',
  })
  accomplishments!: string | null;

  @ApiProperty({
    example: true,
    description:
      'Whether a plan was recorded for this project. Saves a client testing a string for emptiness.',
  })
  hasPlan!: boolean;

  @ApiProperty({ example: false })
  hasWrapUp!: boolean;

  @ApiPropertyOptional({ type: WorkReportUserDto, nullable: true })
  reviewedBy!: WorkReportUserDto | null;

  @ApiPropertyOptional({ example: '2026-08-12T18:00:00.000Z', nullable: true })
  reviewedAt!: Date | null;

  @ApiPropertyOptional({
    example: 'Good progress, nice work on the tests.',
    nullable: true,
  })
  reviewComment!: string | null;

  @ApiProperty({
    example: false,
    description: 'Whether anyone has reviewed this entry yet.',
  })
  isReviewed!: boolean;

  @ApiProperty({ type: DailyProjectEntryCapabilitiesDto })
  capabilities!: DailyProjectEntryCapabilitiesDto;
}

/**
 * What this caller may do to this report (ADR 0002).
 *
 * Both edit flags are time and status dependent, which is exactly the case a
 * permission alone cannot answer. They are computed from the same two
 * predicates the service enforces with, so the button and the rule cannot
 * disagree.
 */
export class DailyWorkReportCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      'Only the author, and only while the report is still PLAN_SUBMITTED. A submitted wrap up locks the plan.',
  })
  canEditPlan!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Only the author, and only within two hours of submitting the wrap up. After that a correction needs an admin.',
  })
  canEditWrapUp!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether the author may still submit the wrap up for this day.',
  })
  canSubmitWrapUp!: boolean;
}

export class DailyWorkReportResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiPropertyOptional({ type: WorkReportUserDto })
  user?: WorkReportUserDto;

  @ApiProperty({
    example: '2026-08-12',
    description:
      'The calendar day this report covers, as a plain date. It carries no timezone, so it must not be rendered in one.',
  })
  date!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({ example: '2026-08-12T09:15:00.000Z', nullable: true })
  planSubmittedAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-08-12T18:02:00.000Z', nullable: true })
  wrapUpSubmittedAt!: Date | null;

  @ApiProperty({ type: [DailyProjectEntryResponseDto] })
  entries!: DailyProjectEntryResponseDto[];

  @ApiProperty({
    example: 3,
    description: 'How many projects this day covers.',
  })
  entryCount!: number;

  @ApiProperty({ example: '2026-08-12T09:15:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-12T18:02:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: DailyWorkReportCapabilitiesDto })
  capabilities!: DailyWorkReportCapabilitiesDto;
}

export class PaginatedDailyWorkReportsResponseDto {
  @ApiProperty({ type: [DailyWorkReportResponseDto] })
  items!: DailyWorkReportResponseDto[];

  @ApiProperty({ example: 22 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

/** The project scoped view: entries across everyone, with their author. */
export class ProjectDailyEntryResponseDto extends DailyProjectEntryResponseDto {
  @ApiProperty({
    example: '2026-08-12',
    description: "The report's calendar day, lifted onto the entry.",
  })
  date!: string;

  @ApiProperty({ type: WorkReportUserDto })
  author!: WorkReportUserDto;
}

export class PaginatedProjectDailyEntriesResponseDto {
  @ApiProperty({ type: [ProjectDailyEntryResponseDto] })
  items!: ProjectDailyEntryResponseDto[];

  @ApiProperty({ example: 48 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryDailyWorkReportsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "View a specific team member's reports instead of your own. DEVELOPER and DESIGNER may only view themselves (403 otherwise); PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN may view anyone.",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Only reports on/after this date (inclusive). Omit both dates to see all time.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Only reports on/before this date (inclusive).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: DAILY_ENTRY_TYPES,
    description:
      'Within each report, only include entries that have a plan (PLAN) or only entries that have a wrap-up (WRAP_UP). Omit to see both. A report with no entry matching this filter is excluded entirely.',
  })
  @IsOptional()
  @IsIn(DAILY_ENTRY_TYPES)
  type?: DailyEntryTypeFilter;
}

export class QueryProjectDailyEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter to a specific team member. Omit to see the whole project team combined.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries whose report date is on/after this date (inclusive). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries whose report date is on/before this date (inclusive).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: DAILY_ENTRY_TYPES,
    description:
      'Only entries that have a plan (PLAN) or only entries that have a wrap-up (WRAP_UP). Omit to see both.',
  })
  @IsOptional()
  @IsIn(DAILY_ENTRY_TYPES)
  type?: DailyEntryTypeFilter;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class DailyProjectEntryPlanDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'Finish auth module\n- Wire up refresh tokens\n- Write unit tests',
  })
  @IsString()
  @IsNotEmpty()
  plan!: string;
}

export class SubmitPlanDto {
  @ApiProperty({ type: [DailyProjectEntryPlanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryPlanDto)
  entries!: DailyProjectEntryPlanDto[];
}

export class UpdatePlanDto {
  @ApiProperty({ type: [DailyProjectEntryPlanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryPlanDto)
  entries!: DailyProjectEntryPlanDto[];
}

// projectId may or may not have appeared in the morning plan. A wrap up can
// include projects that weren't planned (e.g. unplanned or urgent work).
export class DailyProjectEntryWrapUpDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'Completed auth module, 95% done\n- Unit tests passing',
  })
  @IsString()
  @IsNotEmpty()
  accomplishments!: string;
}

export class SubmitWrapUpDto {
  @ApiProperty({ type: [DailyProjectEntryWrapUpDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryWrapUpDto)
  entries!: DailyProjectEntryWrapUpDto[];
}

export class UpdateWrapUpDto {
  @ApiProperty({ type: [DailyProjectEntryWrapUpDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryWrapUpDto)
  entries!: DailyProjectEntryWrapUpDto[];
}

export class ReviewEntryDto {
  @ApiPropertyOptional({ example: 'Good progress, nice work on the tests.' })
  @IsOptional()
  @IsString()
  reviewComment?: string;
}
