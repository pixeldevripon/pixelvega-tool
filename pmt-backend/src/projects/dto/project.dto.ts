import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ProjectActivityType,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import { SORT_ORDERS } from '@/common/dto/sort-query.dto';
import type { SortOrder } from '@/common/dto/sort-query.dto';
import { ToBoolean } from '@/common/decorators/to-boolean.decorator';
import * as FieldLength from '@/common/constants/field-lengths';
import { Trim } from '@/common/decorators/trim.decorator';

const STATUSES = Object.values(ProjectStatus);
const PRIORITIES = Object.values(ProjectPriority);
const PROJECT_TYPES = Object.values(ProjectType);

/** The two priorities that demand a written justification. */
const RUSH_PRIORITIES: ProjectPriority[] = [
  ProjectPriority.URGENT,
  ProjectPriority.CRITICAL,
];

/** The two status moves that demand a written reason. */
const REASON_REQUIRED_STATUSES: ProjectStatus[] = [
  ProjectStatus.ON_HOLD,
  ProjectStatus.CANCELLED,
];

/**
 * The response shapes for the Project entity.
 *
 * There are TWO, and the difference between them is a security boundary rather
 * than a convenience: `ClientProjectResponseDto` is what a CLIENT sees, and it
 * omits every internal field. Keeping it as a class means that contract is
 * stated in the type system and visible in `/api/docs`, instead of living only
 * in a hand written `select` object in the service.
 *
 * These mirror `PROJECT_INCLUDE` and `CLIENT_PROJECT_SELECT` in
 * projects.service.ts. Change them together.
 */

export class UserSummaryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'pm@pixelvega.com' })
  email!: string;
}

export class ProjectTypeTagDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  type!: EnumDisplayDto;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;
}

/**
 * What this caller may do to this project (ADR 0002).
 *
 * One flag per action the UI actually gates, and no more. Each combines the
 * caller's permission with the project scope rule the service enforces, which
 * is the pairing a permission alone cannot express: a PROJECT_MANAGER may edit
 * projects in general and still not this one.
 */
export class ProjectCapabilitiesDto {
  @ApiProperty({ example: true })
  canEdit!: boolean;

  @ApiProperty({
    example: true,
    description:
      'Moving the status. The allowed transitions are a separate question.',
  })
  canChangeStatus!: boolean;

  @ApiProperty({ example: false })
  canChangePriority!: boolean;

  @ApiProperty({ example: false })
  canManageTypes!: boolean;

  @ApiProperty({ example: false })
  canManageEstimatedHours!: boolean;

  @ApiProperty({
    example: false,
    description: 'False when the project is already archived.',
  })
  canArchive!: boolean;

  @ApiProperty({
    example: false,
    description: 'False unless the project IS archived.',
  })
  canRestore!: boolean;

  @ApiProperty({ example: false })
  canConnectSlack!: boolean;

  @ApiProperty({ example: true })
  canManageMembers!: boolean;

  @ApiProperty({ example: true })
  canManageDocuments!: boolean;
}

/**
 * The full internal project. Everything on here beyond what
 * ClientProjectResponseDto carries is deliberately withheld from a CLIENT.
 */
export class ProjectResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Five page marketing site plus a blog.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({
    type: EnumDisplayDto,
    description: 'Internal. Never returned to a CLIENT.',
  })
  priority!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: 'Client launch event moved forward two weeks.',
    nullable: true,
    description:
      'Required when priority is URGENT or CRITICAL, cleared when it moves off them. Internal.',
  })
  rushReason!: string | null;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  clientId!: string | null;

  @ApiPropertyOptional({ type: UserSummaryDto, nullable: true })
  client!: UserSummaryDto | null;

  @ApiPropertyOptional({
    type: UserSummaryDto,
    nullable: true,
    description: 'Who created the project. Internal.',
  })
  createdBy!: UserSummaryDto | null;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', nullable: true })
  plannedStartDate!: Date | null;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  completedAt!: Date | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Required when moving to ON_HOLD. Internal.',
  })
  onHoldReason!: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Required when cancelling. Internal.',
  })
  cancellationReason!: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'A flag layered on top of status, not part of the state machine.',
  })
  archivedAt!: Date | null;

  @ApiPropertyOptional({ example: 'C08ABCDEF', nullable: true })
  slackChannelId!: string | null;

  @ApiPropertyOptional({
    example: 120,
    nullable: true,
    description: 'Manually set.',
  })
  estimatedHours!: number | null;

  @ApiProperty({
    example: 47.5,
    description:
      'Recalculated from completed time segments every time one ends, on pause as well as on stop.',
  })
  actualHours!: number;

  @ApiPropertyOptional({
    example: 72.5,
    nullable: true,
    description:
      'Computed on the way out as estimated minus actual, never stored, so it cannot drift. Null when there is no estimate, which is a different fact from nothing remaining.',
  })
  remainingHours!: number | null;

  @ApiProperty({ type: [ProjectTypeTagDto] })
  projectTypeTags!: ProjectTypeTagDto[];

  @ApiProperty({
    example: false,
    description:
      'Whether the project is archived. Convenience for archivedAt being set, so a client never reasons about a timestamp to answer a yes or no question.',
  })
  isArchived!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether the project has reached a terminal status (COMPLETED or CANCELLED). Derived here so a client cannot disagree about which statuses are terminal.',
  })
  isTerminal!: boolean;

  @ApiPropertyOptional({
    example: 42,
    nullable: true,
    description:
      'Whole days until the deadline, negative when overdue. Null when there is no deadline. Computed against the server clock, which is the only clock the whole team shares.',
  })
  daysUntilDeadline!: number | null;

  @ApiProperty({
    example: false,
    description:
      'Whether the deadline has passed and the project is not finished.',
  })
  isOverdue!: boolean;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: ProjectCapabilitiesDto })
  capabilities!: ProjectCapabilitiesDto;
}

export class ClientProjectTypeTagDto {
  @ApiProperty({ type: EnumDisplayDto })
  type!: EnumDisplayDto;
}

/**
 * What a CLIENT sees for their own project.
 *
 * The absences are the point. No priority, no rushReason, no onHoldReason, no
 * cancellationReason, no createdBy, no hours of any kind. A client is told
 * where their project is, not how the sausage is made.
 */
export class ClientProjectResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Five page marketing site plus a blog.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', nullable: true })
  plannedStartDate!: Date | null;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: [ClientProjectTypeTagDto] })
  projectTypeTags!: ClientProjectTypeTagDto[];

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;
}

export class PaginatedProjectsResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  items!: ProjectResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Present only for a DEVELOPER or DESIGNER: true once their active project count passes the recommended maximum. Advisory, never enforcing.',
  })
  overloaded?: boolean;
}

export class ProjectActivityResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  type!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: 'Status changed from IN_PROGRESS to INTERNAL_REVIEW',
    nullable: true,
  })
  message!: string | null;

  @ApiPropertyOptional({
    example: { from: 'IN_PROGRESS', to: 'INTERNAL_REVIEW' },
    nullable: true,
  })
  metadata!: unknown;

  @ApiPropertyOptional({ type: UserSummaryDto, nullable: true })
  actor!: UserSummaryDto | null;

  @ApiProperty({ example: '2026-08-19T14:32:00.000Z' })
  createdAt!: Date;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

/** The columns a project list may be ordered by. */
export const PROJECT_SORT_FIELDS = [
  'name',
  'deadline',
  'plannedStartDate',
  'createdAt',
  'updatedAt',
] as const;
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export class QueryProjectsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PROJECT_SORT_FIELDS,
    default: 'createdAt',
    description:
      'Sorted before pagination, so page one really does hold the first rows. Note this is the flat list; the dashboard has its own fixed ordering and ignores this.',
  })
  @IsOptional()
  @IsIn(PROJECT_SORT_FIELDS)
  sortBy?: ProjectSortField = 'createdAt';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: SortOrder = 'desc';
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @ApiPropertyOptional({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  @ApiPropertyOptional({
    enum: PROJECT_TYPES,
    isArray: true,
    example: [ProjectType.WORDPRESS, ProjectType.SEO],
    description:
      'Comma-separated (?projectTypes=WORDPRESS,SEO) or repeated (?projectTypes=WORDPRESS&projectTypes=SEO). Matches projects tagged with ANY of the given types, not all of them.',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @IsArray()
  @IsIn(PROJECT_TYPES, { each: true })
  projectTypes?: ProjectType[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Off by default, which returns only non archived projects. Set to true to view only archived projects, a dedicated archive view rather than a mix of both.',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  archived?: boolean = false;

  @ApiPropertyOptional({
    example: 'Acme Website Redesign',
    description:
      'Case insensitive, matches anywhere in the project name. Meant for finding one specific project by name at scale, e.g. inside the archive view above.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FieldLength.SHORT_TEXT)
  search?: string;
}

export class QueryMyProjectsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Off by default, which returns only non archived projects. Set to true to view only archived projects, a dedicated archive view rather than a mix of both. Ignored for a CLIENT caller.',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  archived?: boolean = false;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class CreateProjectDto {
  @ApiProperty({ example: 'Acme Corp Website Redesign' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Full redesign of the marketing site' })
  @IsOptional()
  @IsString()
  description?: string;

  // User.id is a string generated by better-auth, not guaranteed to be a
  // UUID, so @IsUUID() would reject every real user id.
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({
    enum: PROJECT_TYPES,
    isArray: true,
    example: [ProjectType.WORDPRESS, ProjectType.SEO],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PROJECT_TYPES, { each: true })
  projectTypes!: ProjectType[];

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Acme Corp Website Redesign' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Full redesign of the marketing site' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: STATUSES, example: ProjectStatus.ON_HOLD })
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Required when moving to ON_HOLD or CANCELLED',
    example: 'Waiting on client-supplied assets',
  })
  // Required by the trigger, and still type and length checked when
  // supplied anyway, which a bare trigger predicate would skip.
  @Trim()
  @ValidateIf(
    (o: UpdateProjectStatusDto) =>
      REASON_REQUIRED_STATUSES.includes(o.status) || o.reason !== undefined,
  )
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  @IsNotEmpty({
    message: 'reason is required when moving a project to ON_HOLD or CANCELLED',
  })
  reason?: string;
}

export class UpdateProjectPriorityDto {
  @ApiProperty({ enum: PRIORITIES, example: ProjectPriority.URGENT })
  @IsEnum(ProjectPriority)
  priority!: ProjectPriority;

  @ApiPropertyOptional({
    description: 'Required when priority is URGENT or CRITICAL',
    example: 'Client escalated via phone call',
  })
  // Required by the trigger, and still type and length checked when
  // supplied anyway, which a bare trigger predicate would skip.
  @Trim()
  @ValidateIf(
    (o: UpdateProjectPriorityDto) =>
      RUSH_PRIORITIES.includes(o.priority) || o.rushReason !== undefined,
  )
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  @IsNotEmpty({
    message: 'rushReason is required when priority is URGENT or CRITICAL',
  })
  rushReason?: string;
}

export class UpdateProjectTypesDto {
  @ApiProperty({
    enum: PROJECT_TYPES,
    isArray: true,
    example: [ProjectType.WEBFLOW, ProjectType.SEO],
    description:
      'The full replacement set of project types, not a delta. Any type missing from this list is removed; any new one is added.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PROJECT_TYPES, { each: true })
  projectTypes!: ProjectType[];
}

export class UpdateEstimatedHoursDto {
  @ApiProperty({ example: 40, minimum: 0 })
  @IsNumber()
  @Min(0)
  estimatedHours!: number;
}

export class ConnectSlackChannelDto {
  @ApiPropertyOptional({
    example: 'C0BKUALB5F1',
    description:
      "The id of an existing Slack channel to link to this project, for the case where one was already created by hand. Omit to have the system create a brand-new private channel instead. Either way, the project's current active members and all admins are invited into it.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  slackChannelId?: string;
}
