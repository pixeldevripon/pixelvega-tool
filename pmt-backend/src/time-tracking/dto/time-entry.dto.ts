import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { TimeEntryStatus } from '@prisma/client';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import * as FieldLength from '@/common/constants/field-lengths';

const TIME_ENTRY_STATUSES = Object.values(TimeEntryStatus);

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class TimeEntryUserDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;
}

export class TimeEntryProjectDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;
}

/**
 * What this caller may do to this segment (ADR 0002).
 *
 * These are ownership rules that deliberately survive admin: a timer belongs to
 * the person running it, and nobody else pauses, resumes or stops it. The
 * service enforces that, and these flags exist so a UI does not render controls
 * on someone else's running timer.
 */
export class TimeEntryCapabilitiesDto {
  @ApiProperty({
    example: true,
    description: 'Only the owner, and only while the segment is RUNNING.',
  })
  canPause!: boolean;

  @ApiProperty({
    example: false,
    description: 'Only the owner, and only while the segment is PAUSED.',
  })
  canResume!: boolean;

  @ApiProperty({
    example: true,
    description:
      'Only the owner, and only while the segment is not yet STOPPED.',
  })
  canStop!: boolean;
}

/** One segment of tracked project work. */
export class TimeEntryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({
    example: '9c1f3b2a-0d5e-4a7c-8b91-2f6d4e8a1c30',
    description:
      'Groups the segments of one continuous sitting: a pause ends a segment and a resume opens a new one under the same sessionId.',
  })
  sessionId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: 'Fixed the login redirect bug',
    nullable: true,
  })
  notes!: string | null;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  startedAt!: Date;

  @ApiPropertyOptional({
    example: '2026-08-12T16:30:00.000Z',
    nullable: true,
    description: 'Set on pause or stop. Null while the segment is RUNNING.',
  })
  endedAt!: Date | null;

  @ApiPropertyOptional({
    example: 450,
    nullable: true,
    description:
      "This segment's own elapsed minutes, exact. Null while RUNNING, because it has not finished. Use this for any total (ADR 0003).",
  })
  durationMinutes!: number | null;

  @ApiPropertyOptional({
    example: '7h 30m',
    nullable: true,
    description: 'The duration ready to render. Null while RUNNING.',
  })
  durationLabel!: string | null;

  @ApiPropertyOptional({ type: TimeEntryUserDto })
  user?: TimeEntryUserDto;

  @ApiPropertyOptional({ type: TimeEntryProjectDto })
  project?: TimeEntryProjectDto;

  @ApiProperty({ type: TimeEntryCapabilitiesDto })
  capabilities!: TimeEntryCapabilitiesDto;
}

/** A meeting segment. The same shape without a project. */
export class MeetingTimeEntryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({ example: '9c1f3b2a-0d5e-4a7c-8b91-2f6d4e8a1c30' })
  sessionId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({ example: 'Sprint planning', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  startedAt!: Date;

  @ApiPropertyOptional({ example: '2026-08-12T10:00:00.000Z', nullable: true })
  endedAt!: Date | null;

  @ApiPropertyOptional({ example: 60, nullable: true })
  durationMinutes!: number | null;

  @ApiPropertyOptional({ example: '1h', nullable: true })
  durationLabel!: string | null;

  @ApiPropertyOptional({ type: TimeEntryUserDto })
  user?: TimeEntryUserDto;

  @ApiProperty({ type: TimeEntryCapabilitiesDto })
  capabilities!: TimeEntryCapabilitiesDto;
}

/**
 * Whether a user has a timer running, and which kind.
 *
 * One endpoint answers for both project and meeting timers because the rule is
 * that a person has at most ONE running timer of either kind. Two endpoints
 * would let a client believe otherwise.
 */
export class ActiveTimeEntryResponseDto {
  @ApiProperty({ example: true })
  active!: boolean;

  @ApiPropertyOptional({
    enum: ['PROJECT', 'MEETING'],
    nullable: true,
    example: 'PROJECT',
    description: 'Null when nothing is running.',
  })
  kind!: 'PROJECT' | 'MEETING' | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The running segment, or null when nothing is running.',
  })
  entry!: TimeEntryResponseDto | MeetingTimeEntryResponseDto | null;
}

/** A stop, and whether the server had already auto stopped it first. */
export class StopTimeEntryResponseDto {
  @ApiProperty({ type: TimeEntryResponseDto })
  entry!: TimeEntryResponseDto;

  @ApiProperty({
    example: false,
    description:
      'True when the segment had already hit the automatic cutoff and was stopped by the server before this request arrived.',
  })
  wasAutoStopped!: boolean;
}

export class StopMeetingTimeEntryResponseDto {
  @ApiProperty({ type: MeetingTimeEntryResponseDto })
  entry!: MeetingTimeEntryResponseDto;

  @ApiProperty({ example: false })
  wasAutoStopped!: boolean;
}

/**
 * A paginated list of segments, plus the totals for the WHOLE filter.
 *
 * The totals deliberately cover every matching entry, not the current page: a
 * footer reading "total 42h" that silently meant "42h on this page" is the bug
 * this shape prevents.
 */
export class PaginatedTimeEntriesResponseDto {
  @ApiProperty({ type: [TimeEntryResponseDto] })
  items!: TimeEntryResponseDto[];

  @ApiProperty({ example: 37 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({
    example: 2530,
    description: 'Exact minutes across every entry matching the filter.',
  })
  totalMinutes!: number;

  @ApiProperty({ example: 42.17, description: 'The same total in hours, 2dp.' })
  totalHours!: number;

  @ApiProperty({ example: '42h 10m' })
  totalLabel!: string;
}

export class PaginatedMeetingTimeEntriesResponseDto {
  @ApiProperty({ type: [MeetingTimeEntryResponseDto] })
  items!: MeetingTimeEntryResponseDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 480 })
  totalMinutes!: number;

  @ApiProperty({ example: 8 })
  totalHours!: number;

  @ApiProperty({ example: '8h' })
  totalLabel!: string;
}

export class ProjectTimeTotalDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiPropertyOptional({
    example: 'Acme corporate site',
    nullable: true,
    description:
      'Null only if the project row disappeared between the aggregate and the name lookup. Not expected, and not worth inventing a placeholder for.',
  })
  projectName!: string | null;

  @ApiProperty({ example: 900 })
  totalMinutes!: number;

  @ApiProperty({ example: 15 })
  totalHours!: number;

  @ApiProperty({ example: '15h' })
  totalLabel!: string;
}

/**
 * One user's hours broken down by project.
 *
 * `projects` arrives already sorted, heaviest first. Ordering is a decision
 * about what matters, so the server makes it (D4) and the client renders the
 * array in the order it receives.
 */
export class UserProjectSummaryResponseDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({ type: [ProjectTimeTotalDto] })
  projects!: ProjectTimeTotalDto[];

  @ApiProperty({ example: 2530 })
  totalMinutes!: number;

  @ApiProperty({ example: 42.17 })
  totalHours!: number;

  @ApiProperty({ example: '42h 10m' })
  totalLabel!: string;
}

export class DailyTimeTotalDto {
  @ApiProperty({
    example: '2026-08-12',
    description:
      'The calendar day the segment started, in UTC. A segment crossing midnight is not split.',
  })
  date!: string;

  @ApiProperty({ example: 450 })
  totalMinutes!: number;

  @ApiProperty({ example: 7.5 })
  totalHours!: number;

  @ApiProperty({ example: '7h 30m' })
  totalLabel!: string;
}

export class DailySummaryResponseDto {
  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  projectId?: string | null;

  @ApiPropertyOptional({
    example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg',
    nullable: true,
    description: 'Null when the summary covers the whole project team.',
  })
  userId!: string | null;

  @ApiProperty({ type: [DailyTimeTotalDto] })
  days!: DailyTimeTotalDto[];

  @ApiProperty({ example: 2530 })
  totalMinutes!: number;

  @ApiProperty({ example: 42.17 })
  totalHours!: number;

  @ApiProperty({ example: '42h 10m' })
  totalLabel!: string;
}

export class CombinedDayTotalDto {
  @ApiProperty({ example: '2026-08-12' })
  date!: string;

  @ApiProperty({ example: 450 })
  projectMinutes!: number;

  @ApiProperty({ example: '7h 30m' })
  projectLabel!: string;

  @ApiProperty({ example: 60 })
  meetingMinutes!: number;

  @ApiProperty({ example: '1h' })
  meetingLabel!: string;

  @ApiProperty({ example: 510 })
  totalMinutes!: number;

  @ApiProperty({ example: 8.5 })
  totalHours!: number;

  @ApiProperty({ example: '8h 30m' })
  totalLabel!: string;
}

/**
 * Project hours beside meeting hours, day by day, for one person.
 *
 * The two are kept separate as well as summed because they answer different
 * questions: billable delivery time versus time the day went to. Collapsing
 * them would lose that, and a client re-deriving the split from two calls would
 * be doing arithmetic the server already did.
 */
export class CombinedDailySummaryResponseDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({ type: [CombinedDayTotalDto] })
  days!: CombinedDayTotalDto[];

  @ApiProperty({ example: 2530 })
  totalProjectMinutes!: number;

  @ApiProperty({ example: '42h 10m' })
  totalProjectLabel!: string;

  @ApiProperty({ example: 300 })
  totalMeetingMinutes!: number;

  @ApiProperty({ example: '5h' })
  totalMeetingLabel!: string;

  @ApiProperty({ example: 2830 })
  totalMinutes!: number;

  @ApiProperty({ example: 47.17 })
  totalHours!: number;

  @ApiProperty({ example: '47h 10m' })
  totalLabel!: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryTimeEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter to a specific team member. Any active project member can use this, matching document and activity visibility elsewhere in this module. Omit to see the whole project team combined.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({ enum: TIME_ENTRY_STATUSES })
  @IsOptional()
  @IsEnum(TimeEntryStatus)
  status?: TimeEntryStatus;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries that started on/after this date (inclusive, whole day). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries that started on/before this date (inclusive, whole day).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Same shape as QueryTimeEntriesDto, minus anything project scoped, there is
// no projectId here to filter by.
export class QueryMeetingTimeEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Whose meeting entries to list, defaults to the caller. DEVELOPER and DESIGNER can only list their own; PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({ enum: TIME_ENTRY_STATUSES })
  @IsOptional()
  @IsEnum(TimeEntryStatus)
  status?: TimeEntryStatus;

  @ApiPropertyOptional({
    example: '2026-08-05',
    description:
      'Only entries that started on/after this date (inclusive, whole day). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-05',
    description:
      'Only entries that started on/before this date (inclusive, whole day).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class QueryProjectSummaryDto {
  @ApiPropertyOptional({
    description:
      "Whose hours to summarize, defaulting to the caller. PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN may pass a different user's id; DEVELOPER and DESIGNER can only view their own.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-18',
    description:
      'Only entries that started on/after this date (inclusive, whole day). Set both startDate and endDate to today to answer "how many hours did they log today, by project".',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-18',
    description:
      'Only entries that started on/before this date (inclusive, whole day).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Cross-project, cross-meeting: backs the combined GET
// /time-entries/daily-summary, not the project scoped
// GET /projects/:projectId/time-entries/daily-summary (which reuses
// QueryTimeEntriesDto instead). Same shape as QueryProjectSummaryDto, no
// status filter since this sums both project and meeting time together.
export class QueryDailySummaryDto {
  @ApiPropertyOptional({
    description:
      "Whose day-by-day hours to show, defaults to the caller. DEVELOPER and DESIGNER can only view their own; PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'Only days on/after this date (inclusive). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-05',
    description: 'Only days on/before this date (inclusive).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class QueryActiveTimeEntryDto {
  @ApiPropertyOptional({
    description:
      "Check a specific user's active timer instead of your own. PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN only.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

// Shared body shape for start/pause/resume/stop. All four actions optionally
// attach a note describing that segment of work, so there's no reason for
// four DTOs that are nearly identical.
export class TimeEntryNoteDto {
  @ApiPropertyOptional({ example: 'Fixed the login redirect bug' })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.LONG_TEXT)
  notes?: string;
}
