import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { EnumDisplayDto } from '@/common/dto/display.dto';
import { DASHBOARD_AUDIENCES } from '@/common/utils/enum-display.util';

// ══════════════════════════════════════════════════════════════════════════
// Response
// ══════════════════════════════════════════════════════════════════════════
//
// Every number here is a field, and none of it is derivable in a browser
// without a second copy of a business rule (D4). "At risk" is the clearest
// case: whether a project counts depends on its deadline, its status AND its
// unresolved blockers, so a client computing it would need three lists and the
// definition. It gets one boolean.
//
// A count is 0 when the answer is genuinely none. A RATE is null when its
// denominator is zero, never 0: zero would claim a measured result of nothing,
// where null says the question does not apply. That convention is already set
// by `developer-report.dto.ts`.

/**
 * Who is working on a project, for the card that shows it.
 *
 * The name and the avatar travel together because the card renders an avatar
 * with the name as its fallback and its tooltip. Sending only an id would make
 * every card fetch its own members, which is one request per card on a screen
 * whose whole job is to load at once.
 */
export class DashboardMemberDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Jabed Hasan' })
  name!: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/pv/image/upload/v1/avatars/abc.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    type: EnumDisplayDto,
    description: 'Their role ON THIS PROJECT, which is not their account role.',
  })
  projectRole!: EnumDisplayDto;
}

export class DashboardProjectDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({ type: EnumDisplayDto })
  priority!: EnumDisplayDto;

  @ApiPropertyOptional({ example: '2026-09-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description:
      'Whole days until the deadline, negative when overdue. Null when there is no deadline.',
  })
  daysUntilDeadline!: number | null;

  @ApiProperty({
    example: false,
    description:
      'Past its deadline and not finished. A COMPLETED or CANCELLED project is never overdue: it is finished.',
  })
  isOverdue!: boolean;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', nullable: true })
  plannedStartDate!: Date | null;

  @ApiProperty({ example: 40 })
  progressPercentage!: number;

  @ApiPropertyOptional({ example: 120, nullable: true })
  estimatedHours!: number | null;

  @ApiProperty({ example: 47.5 })
  actualHours!: number;

  @ApiPropertyOptional({
    example: 72.5,
    nullable: true,
    description:
      'Null when no estimate has been set, because "remaining" has nothing to be remaining against.',
  })
  remainingHours!: number | null;

  @ApiProperty({
    example: true,
    description:
      'Ready for work or in progress. What makes a project sort above the rest.',
  })
  isActive!: boolean;

  @ApiProperty({
    example: 1,
    description: 'Unresolved blockers on this project.',
  })
  openBlockerCount!: number;

  @ApiProperty({
    example: 1,
    description:
      'Unresolved blockers at HIGH severity. Sent separately so a card can say "1 high" without receiving every blocker row to count them itself.',
  })
  highSeverityBlockerCount!: number;

  @ApiProperty({
    type: [DashboardMemberDto],
    description:
      'Currently staffed members, project managers first. Only rows where leftAt is null: people who left are part of the project’s history, not of who is working on it now.',
  })
  members!: DashboardMemberDto[];
}

/**
 * The reduced projection a CLIENT sees. Status and deadline, and nothing else.
 *
 * A separate class rather than a subset of `DashboardProjectDto`, because the
 * fields a client must NOT receive are the point. Reusing the wider class and
 * omitting fields at runtime is how an internal number reaches a client the
 * first time someone edits the mapper.
 */
export class DashboardClientProjectDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiPropertyOptional({ example: '2026-09-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiProperty({
    example: false,
    description:
      'The project is waiting for this client to approve or request changes.',
  })
  isAwaitingMyFeedback!: boolean;
}

export class DashboardCountDto {
  @ApiProperty({
    type: EnumDisplayDto,
    description: 'The status or severity this count is for.',
  })
  key!: EnumDisplayDto;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class DashboardActiveTimerDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  timeEntryId!: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
    description: 'Null for a meeting timer, which need not have a project.',
  })
  projectId!: string | null;

  @ApiPropertyOptional({ example: 'Acme corporate site', nullable: true })
  projectName!: string | null;

  @ApiProperty({ example: '2026-08-20T09:15:00.000Z' })
  startedAt!: Date;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({
    example: 95,
    description:
      'Minutes elapsed, excluding paused time, against the server clock. The client renders this and counts up from it rather than computing the total itself.',
  })
  elapsedMinutes!: number;

  @ApiProperty({ example: '1h 35m' })
  elapsedLabel!: string;
}

export class DashboardHoursDto {
  @ApiProperty({ example: 450 })
  minutes!: number;

  @ApiProperty({ example: 7.5 })
  hours!: number;

  @ApiProperty({ example: '7h 30m' })
  label!: string;
}

export class DashboardComplianceDto {
  @ApiProperty({ example: 9, description: 'People who submitted today.' })
  submitted!: number;

  @ApiProperty({ example: 12, description: 'People who were expected to.' })
  expected!: number;

  @ApiPropertyOptional({
    example: 0.75,
    nullable: true,
    description:
      'Null when nobody was expected, which is not the same as nobody submitting.',
  })
  rate!: number | null;

  @ApiPropertyOptional({ example: '75%', nullable: true })
  rateLabel!: string | null;
}

/**
 * A CLIENT's dashboard.
 *
 * `features.md`: "A client sees the status and the deadline, and nothing else."
 * So there are no hours, no blockers and no team here, and the project rows are
 * the reduced projection.
 */
export class ClientDashboardDto {
  @ApiProperty({
    type: [DashboardClientProjectDto],
    description:
      'The client’s own projects, never anyone else’s, already ordered.',
  })
  projects!: DashboardClientProjectDto[];

  @ApiProperty({
    example: 1,
    description:
      'How many of those projects are waiting on this client to approve or request changes. The one number a client can act on.',
  })
  awaitingMyFeedbackCount!: number;
}

/**
 * A DEVELOPER or DESIGNER's dashboard: their own day.
 *
 * The project list is scoped to active `ProjectMember` rows and ordered by
 * `compareForDashboard`, which is priority, then deadline, then planned start,
 * with ready-for-work and in-progress ahead of everything else. That ordering
 * is the requirement, and it lives in one place so this list and
 * `GET /projects/mine` cannot disagree about it.
 */
export class StaffDashboardDto {
  @ApiProperty({
    type: [DashboardProjectDto],
    description:
      'Projects where the caller is an active member, in the order they should render.',
  })
  myProjects!: DashboardProjectDto[];

  @ApiPropertyOptional({
    type: DashboardActiveTimerDto,
    nullable: true,
    description:
      'The caller’s running timer, project or meeting. Null when nothing is running. At most one can exist per person.',
  })
  activeTimer!: DashboardActiveTimerDto | null;

  @ApiProperty({ type: DashboardHoursDto })
  today!: DashboardHoursDto;

  @ApiProperty({ type: DashboardHoursDto })
  thisWeek!: DashboardHoursDto;

  @ApiProperty({
    example: 2,
    description:
      'Unresolved blockers the caller reported or is assigned, across every project.',
  })
  myOpenBlockerCount!: number;

  @ApiPropertyOptional({
    type: EnumDisplayDto,
    nullable: true,
    description:
      'Where the caller is in today’s standup. Null on a non working day, which is not the same as "not started".',
  })
  todayWorkReportStatus!: EnumDisplayDto | null;
}

/**
 * A PROJECT_MANAGER's dashboard: the projects they are responsible for, and the
 * queues waiting on them.
 */
export class ManagerDashboardDto {
  @ApiProperty({
    type: [DashboardCountDto],
    description:
      'Every status with at least one project, in lifecycle order rather than by count, so the shape of the pipeline is readable at a glance.',
  })
  projectsByStatus!: DashboardCountDto[];

  @ApiProperty({ example: 14 })
  activeProjectCount!: number;

  @ApiProperty({
    type: [DashboardProjectDto],
    description:
      'Projects that are overdue or blocked, worst first. See the service for the definition, which is deliberately in one place.',
  })
  atRiskProjects!: DashboardProjectDto[];

  @ApiProperty({ type: [DashboardCountDto] })
  openBlockersBySeverity!: DashboardCountDto[];

  @ApiProperty({
    example: 3,
    description: 'Additional requirements waiting for a decision.',
  })
  pendingRequirementCount!: number;

  @ApiProperty({
    example: 2,
    description: 'Projects sitting in Waiting For Feedback.',
  })
  awaitingClientFeedbackCount!: number;

  @ApiProperty({
    example: 1,
    description: 'Projects sitting in Internal Review.',
  })
  internalReviewQueueCount!: number;

  @ApiProperty({ type: DashboardComplianceDto })
  standupComplianceToday!: DashboardComplianceDto;
}

/**
 * An ADMIN or SYSTEM_ADMIN's dashboard.
 *
 * Everything the manager sees, unscoped, plus the two queues only an admin can
 * clear. It repeats the manager fields rather than nesting a manager block:
 * a client reading `admin.activeProjectCount` should not have to know that an
 * admin dashboard contains a manager dashboard.
 */
export class AdminDashboardDto {
  @ApiProperty({ type: [DashboardCountDto] })
  projectsByStatus!: DashboardCountDto[];

  @ApiProperty({ example: 22 })
  activeProjectCount!: number;

  @ApiProperty({ type: [DashboardProjectDto] })
  atRiskProjects!: DashboardProjectDto[];

  @ApiProperty({ type: [DashboardCountDto] })
  openBlockersBySeverity!: DashboardCountDto[];

  @ApiProperty({ example: 5 })
  pendingRequirementCount!: number;

  @ApiProperty({ example: 3 })
  awaitingClientFeedbackCount!: number;

  @ApiProperty({ example: 2 })
  internalReviewQueueCount!: number;

  @ApiProperty({ type: DashboardComplianceDto })
  standupComplianceToday!: DashboardComplianceDto;

  @ApiProperty({
    example: 4,
    description:
      'Leave requests waiting for a decision. Only an admin may approve or reject one, which is why this appears here and not on the manager dashboard.',
  })
  pendingLeaveRequestCount!: number;

  @ApiProperty({
    example: 26,
    description: 'People with an active account.',
  })
  activeUserCount!: number;
}

/**
 * The landing screen.
 *
 * `audience` says which block is populated, and **exactly one is**. The other
 * three are null.
 *
 * The alternative was four routes and a client that works out which one it may
 * call. That is derivation, and deriving it in a browser means a second copy of
 * the rule that decides it (D4, D2). Here the server answers the question it is
 * the authority on, in one round trip, and the client switches on a string.
 */
export class DashboardResponseDto {
  @ApiProperty({
    type: EnumDisplayDto,
    enum: DASHBOARD_AUDIENCES,
    description:
      'Which block below is populated. Decided from the caller’s permission set, never from their role.',
  })
  audience!: EnumDisplayDto;

  @ApiProperty({
    example: '2026-08-20T10:31:00.000Z',
    description:
      'When these figures were read, on the server clock. A screen showing a relative time ("2 minutes ago") measures against this rather than against the browser clock, which is not the clock the numbers came from.',
  })
  generatedAt!: Date;

  @ApiPropertyOptional({ type: AdminDashboardDto, nullable: true })
  admin!: AdminDashboardDto | null;

  @ApiPropertyOptional({ type: ManagerDashboardDto, nullable: true })
  manager!: ManagerDashboardDto | null;

  @ApiPropertyOptional({ type: StaffDashboardDto, nullable: true })
  staff!: StaffDashboardDto | null;

  @ApiPropertyOptional({ type: ClientDashboardDto, nullable: true })
  client!: ClientDashboardDto | null;
}

// ══════════════════════════════════════════════════════════════════════════
// Query
// ══════════════════════════════════════════════════════════════════════════
//
// None. The dashboard describes the caller's present state, so there is nothing
// to filter and nothing to page: every list on it is deliberately bounded by the
// service rather than by a client-supplied page size.

// ══════════════════════════════════════════════════════════════════════════
// Request
// ══════════════════════════════════════════════════════════════════════════
//
// None. The dashboard is read only.
