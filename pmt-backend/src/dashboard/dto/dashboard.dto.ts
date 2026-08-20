import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { EnumDisplayDto } from '@/common/dto/display.dto';
import { DASHBOARD_AUDIENCES } from '@/common/utils/enum-display.util';

// ══════════════════════════════════════════════════════════════════════════
// Response
// ══════════════════════════════════════════════════════════════════════════
//
// The landing screen, and it is deliberately DENSE: whoever signs in should be
// able to answer "what is the state of my work" without opening anything else.
//
// Every number here is a field, and almost none of it is derivable in a browser
// without a second copy of a business rule (D4). Four reasons why:
//
// - "At risk" depends on a deadline, a status AND unresolved blockers, so a
//   client computing it would need three lists and the definition.
// - A DELTA depends on knowing which previous window to compare against. Two
//   clients picking different baselines would disagree about whether a number is
//   improving, which is the entire point of showing a delta.
// - A SHARE has to be computed once, or clients rounding their own would produce
//   slices that do not sum to 100%.
// - "Who may manage this project" depends on ProjectMember rows a client never
//   sees, which is why it arrives as a capability flag.
//
// A count is 0 when the answer is genuinely none. A RATE, SHARE or DELTA is null
// when there is nothing to compare against, never 0: zero claims a measured
// result of nothing, where null says the question does not apply.

export class DashboardRangeDto {
  @ApiProperty({ example: '2026-08-07T00:00:00.000Z' })
  from!: Date;

  @ApiProperty({ example: '2026-08-20T23:59:59.999Z' })
  to!: Date;

  @ApiProperty({ example: 14 })
  days!: number;

  @ApiProperty({
    example: 'Last 14 days',
    description:
      'Resolved on the server from the same dates the figures were filtered by, so a label can never describe a window the numbers did not come from.',
  })
  label!: string;
}

/** One point on a line, a bar, or a sparkline. */
export class DashboardSeriesPointDto {
  @ApiProperty({ example: '2026-08-20' })
  date!: string;

  @ApiProperty({ example: 'Wed 20' })
  label!: string;

  @ApiProperty({ example: 450 })
  value!: number;

  @ApiProperty({ example: '7h 30m' })
  valueLabel!: string;

  @ApiProperty({
    example: true,
    description:
      'A working day for this team, which is Saturday to Thursday. A chart dips to zero on the weekly off day, and without this a reader cannot tell a day off from a day nobody worked.',
  })
  isWorkingDay!: boolean;
}

export class DashboardSeriesDto {
  @ApiProperty({ example: 'Hours logged' })
  label!: string;

  @ApiProperty({ type: [DashboardSeriesPointDto] })
  points!: DashboardSeriesPointDto[];

  @ApiProperty({ example: 5400 })
  totalValue!: number;

  @ApiProperty({ example: '90h' })
  totalLabel!: string;

  @ApiPropertyOptional({
    example: 480,
    nullable: true,
    description:
      'The per-day target this series should be read against, when one applies. Null when the series is not hours.',
  })
  dailyTarget!: number | null;
}

/**
 * A headline figure with its change against the previous equivalent window.
 *
 * The comparison window is the SAME LENGTH immediately before this one, decided
 * on the server. Two clients choosing their own baselines would disagree about
 * whether the number is improving.
 */
export class DashboardMetricDto {
  @ApiProperty({
    example: 'activeProjects',
    description:
      'Stable identifier, for a client that wants to place a specific tile. Never rendered.',
  })
  key!: string;

  @ApiProperty({ example: 'Active projects' })
  label!: string;

  @ApiPropertyOptional({
    example: 'Last 14 days',
    nullable: true,
    description:
      'The window this figure covers, when it is not the whole range.',
  })
  caption!: string | null;

  @ApiProperty({
    example: 14,
    description:
      'The exact value. Hours are MINUTES here, with valueLabel carrying the readable form, so nothing formatted ever feeds a calculation (ADR 0003).',
  })
  value!: number;

  @ApiProperty({ example: '14' })
  valueLabel!: string;

  @ApiPropertyOptional({
    example: 11,
    nullable: true,
    description:
      'The same figure over the previous window of equal length. Null when there is no comparable history.',
  })
  previousValue!: number | null;

  @ApiPropertyOptional({
    example: 0.2727,
    nullable: true,
    description:
      'Proportional change against previousValue. Null when that was zero, because a change from nothing has no percentage.',
  })
  changeRate!: number | null;

  @ApiPropertyOptional({ example: '+27%', nullable: true })
  changeLabel!: string | null;

  @ApiProperty({
    type: EnumDisplayDto,
    description:
      'How this figure reads. Whether up is good is a judgment about the business rather than a styling choice: more overdue projects going up is danger, more hours logged going up is not.',
  })
  tone!: EnumDisplayDto;
}

/**
 * A proportion of a whole, for the segmented bars and the donut.
 *
 * `share` is sent rather than left to the client, because a client dividing by a
 * total it also received would round differently from every other client and the
 * slices would stop summing to 100%.
 */
export class DashboardSliceDto {
  @ApiProperty({ type: EnumDisplayDto })
  key!: EnumDisplayDto;

  @ApiProperty({ example: 6 })
  count!: number;

  @ApiProperty({ example: 0.42 })
  share!: number;

  @ApiProperty({ example: '42%' })
  shareLabel!: string;
}

export class DashboardBreakdownDto {
  @ApiProperty({ example: 'Projects by status' })
  label!: string;

  @ApiProperty({
    example: 14,
    description:
      'The figure a donut shows in its centre. Sent so the centre and the slices can never disagree.',
  })
  total!: number;

  @ApiProperty({ example: '14 projects' })
  totalLabel!: string;

  @ApiProperty({
    type: [DashboardSliceDto],
    description:
      'In the enum declared order, not descending by size: sorting by count reorders the board every time a project moves, so a reader can never learn where to look. Keys with no rows are omitted.',
  })
  slices!: DashboardSliceDto[];
}

/** A row in a ranked list, the "top N by X" cards. */
export class DashboardRankedRowDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme corporate site' })
  name!: string;

  @ApiPropertyOptional({
    example: 'WordPress, SEO',
    nullable: true,
    description:
      'A second line: a project types, or a person designation. Null when there is nothing to add.',
  })
  subtitle!: string | null;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/pv/image/upload/v1/avatars/abc.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ example: 2730 })
  value!: number;

  @ApiProperty({ example: '45h 30m' })
  valueLabel!: string;

  @ApiProperty({
    example: 0.31,
    description:
      'This row share of the list total, for the bar a ranked row draws behind itself.',
  })
  share!: number;

  @ApiPropertyOptional({
    example: 0.12,
    nullable: true,
    description: 'Change against the previous window of equal length.',
  })
  changeRate!: number | null;

  @ApiPropertyOptional({ example: '+12%', nullable: true })
  changeLabel!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  tone!: EnumDisplayDto;
}

export class DashboardRankedListDto {
  @ApiProperty({ example: 'Top projects by hours' })
  label!: string;

  @ApiProperty({ example: 'Last 14 days' })
  caption!: string;

  @ApiProperty({ type: [DashboardRankedRowDto] })
  rows!: DashboardRankedRowDto[];
}

/**
 * Who is working on a project, for the card that shows it.
 *
 * The name and the avatar travel together because the card renders an avatar
 * with the name as its fallback and its tooltip. Sending only an id would make
 * every card fetch its own members: one request per card, on a screen whose
 * whole job is to load at once.
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

/**
 * What the caller may do to THIS project.
 *
 * This is the difference between seeing and managing, and it is what lets the
 * dashboard show a project manager every project without implying they may
 * change every one:
 *
 * - An ADMIN or SYSTEM_ADMIN sees everything and may manage anything.
 * - A PROJECT_MANAGER sees every project and may manage only those they are
 *   staffed on as a project manager.
 * - A DEVELOPER or DESIGNER sees only projects they are staffed on, and manages
 *   none of them.
 *
 * Advisory, as every capability flag is: the service enforces the same predicate
 * on the write. They must read the SAME predicate rather than two copies, which
 * pmt-backend/CLAUDE.md names as the most repeated defect in this codebase.
 */
export class DashboardProjectCapabilitiesDto {
  @ApiProperty({
    example: false,
    description:
      'May edit the project, staff it, and move it through its lifecycle.',
  })
  canManage!: boolean;

  @ApiProperty({
    example: true,
    description:
      'May start a timer on it: a developer or designer staffed on this project. A project manager holds no tracking permission, so this is false for them even where canManage is true.',
  })
  canTrackTime!: boolean;

  @ApiProperty({
    example: false,
    description: 'Is currently staffed on this project, in any project role.',
  })
  isMember!: boolean;
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

  @ApiProperty({
    type: [EnumDisplayDto],
    description:
      'WordPress, SEO, and so on. A project can carry more than one.',
  })
  types!: EnumDisplayDto[];

  @ApiPropertyOptional({ example: '2026-09-15T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description:
      'Whole days until the deadline, negative when overdue. Null when there is no deadline.',
  })
  daysUntilDeadline!: number | null;

  @ApiPropertyOptional({
    example: 'in 12 days',
    nullable: true,
    description:
      'The deadline in words, resolved against the server clock. A browser computing this would measure against its own clock, which is not the clock the number came from.',
  })
  deadlineLabel!: string | null;

  @ApiProperty({
    example: false,
    description:
      'Past its deadline and not finished. A COMPLETED or CANCELLED project is never overdue: it is finished.',
  })
  isOverdue!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Overdue, or blocked, or both. The single flag a card colours itself from, so two screens cannot disagree about what "at risk" means.',
  })
  isAtRisk!: boolean;

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

  @ApiPropertyOptional({
    example: 0.4,
    nullable: true,
    description:
      'Actual hours as a share of the estimate. Above 1 means the estimate has been exceeded. Null without an estimate.',
  })
  hoursUsedRate!: number | null;

  @ApiProperty({
    example: true,
    description:
      'Ready for work or in progress. What makes a project sort above the rest.',
  })
  isActive!: boolean;

  @ApiProperty({ example: 1, description: 'Unresolved blockers.' })
  openBlockerCount!: number;

  @ApiProperty({
    example: 1,
    description:
      'Unresolved blockers at HIGH severity, so a card can say "1 high" without receiving every blocker row to count them itself.',
  })
  highSeverityBlockerCount!: number;

  @ApiProperty({
    example: 450,
    description: 'Minutes logged on this project inside the response range.',
  })
  minutesInRange!: number;

  @ApiProperty({ example: '7h 30m' })
  minutesInRangeLabel!: string;

  @ApiPropertyOptional({
    example: '2026-08-20T09:15:00.000Z',
    nullable: true,
    description: 'When anyone last logged time. Null when nobody has.',
  })
  lastWorkedAt!: Date | null;

  @ApiProperty({
    type: [DashboardMemberDto],
    description:
      'Currently staffed members, project managers first. Only rows where leftAt is null: people who left are part of the project history, not of who is working on it.',
  })
  members!: DashboardMemberDto[];

  @ApiProperty({ type: DashboardProjectCapabilitiesDto })
  capabilities!: DashboardProjectCapabilitiesDto;
}

/**
 * The reduced projection a CLIENT sees. Status and deadline, and nothing else.
 *
 * A separate class rather than a subset of DashboardProjectDto, because the
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

  @ApiPropertyOptional({ example: 'in 12 days', nullable: true })
  deadlineLabel!: string | null;

  @ApiProperty({
    example: false,
    description:
      'The project is waiting for this client to approve or request changes.',
  })
  isAwaitingMyFeedback!: boolean;
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
      'Null when nobody was expected, which is not the same as nobody submitting. On a day the whole team is on leave those two answers are indistinguishable to a client that only receives a number.',
  })
  rate!: number | null;

  @ApiPropertyOptional({ example: '75%', nullable: true })
  rateLabel!: string | null;
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
      'Minutes elapsed, excluding paused time, against the server clock. A client renders this and counts up from it rather than computing the total itself.',
  })
  elapsedMinutes!: number;

  @ApiProperty({ example: '1h 35m' })
  elapsedLabel!: string;
}

/**
 * The caller own day. Present only for someone who actually does the work: a
 * DEVELOPER or DESIGNER, who hold TRACK_PROJECT_TIME and SUBMIT_WORK_REPORT.
 *
 * Null for a PROJECT_MANAGER, deliberately. They hold neither permission, which
 * is the same reason they have no "My day" in the navigation, and sending them an
 * empty timer card would imply a control they do not have.
 */
export class DashboardMyDayDto {
  @ApiPropertyOptional({
    type: DashboardActiveTimerDto,
    nullable: true,
    description:
      'The caller running timer, project or meeting. Null when nothing is running. At most one can exist per person, across every project.',
  })
  activeTimer!: DashboardActiveTimerDto | null;

  @ApiProperty({ type: DashboardHoursDto })
  today!: DashboardHoursDto;

  @ApiProperty({ type: DashboardHoursDto })
  thisWeek!: DashboardHoursDto;

  @ApiProperty({
    example: 2880,
    description:
      'The week target in minutes, from the team working-day constants, so a client does not multiply eight by six itself.',
  })
  weekTargetMinutes!: number;

  @ApiProperty({
    type: DashboardSeriesDto,
    description: 'The caller own hours per day across the range.',
  })
  myHoursTrend!: DashboardSeriesDto;

  @ApiPropertyOptional({
    type: EnumDisplayDto,
    nullable: true,
    description:
      'Where the caller is in today standup. Null on a non working day, which is not the same as "not started".',
  })
  todayWorkReportStatus!: EnumDisplayDto | null;

  @ApiProperty({
    example: 2,
    description:
      'Unresolved blockers the caller reported or is assigned, across every project.',
  })
  myOpenBlockerCount!: number;
}

/** The queues waiting on somebody, and who they are waiting on. */
export class DashboardAttentionDto {
  @ApiProperty({
    example: 3,
    description: 'Additional requirements waiting for a decision.',
  })
  pendingRequirementCount!: number;

  @ApiProperty({
    example: 1,
    description: 'Projects sitting in Internal Review.',
  })
  internalReviewCount!: number;

  @ApiProperty({
    example: 2,
    description: 'Projects sitting in Waiting For Feedback.',
  })
  awaitingClientFeedbackCount!: number;

  @ApiProperty({ example: 4, description: 'Projects past their deadline.' })
  overdueProjectCount!: number;

  @ApiProperty({
    example: 2,
    description:
      'Projects still in Planning without enough of a team to leave it.',
  })
  notReadyToStartCount!: number;

  @ApiPropertyOptional({
    example: 4,
    nullable: true,
    description:
      'Leave requests waiting for a decision. Null unless the caller may actually review one: only an Admin can approve or reject, so showing the number to a project manager would offer work they cannot do.',
  })
  pendingLeaveRequestCount!: number | null;
}

/**
 * The workspace overview, shared by every INTERNAL audience and differing only
 * in scope.
 *
 * One shape rather than three, because an administrator, a project manager and a
 * developer all want the same picture of the work: what is running, where the
 * hours went, what is at risk, and what is waiting on somebody. What differs is
 * WHICH projects are in it, and that is decided by the query rather than by the
 * shape. One shape also means the frontend builds one layout instead of three.
 *
 * A section that does not apply is null rather than empty, and null means "this
 * does not concern you" rather than "there is nothing here". A developer
 * topContributors is null because a leaderboard of colleagues is not their
 * business; an empty list would claim the team logged no hours at all.
 */
export class WorkspaceDashboardDto {
  @ApiProperty({
    type: [DashboardMetricDto],
    description:
      'The headline tiles, in the order they should render. Each carries its own delta and tone.',
  })
  headline!: DashboardMetricDto[];

  @ApiProperty({
    type: DashboardSeriesDto,
    description: 'Hours logged per day across the caller scope.',
  })
  hoursTrend!: DashboardSeriesDto;

  @ApiProperty({
    type: DashboardBreakdownDto,
    description: 'Projects by status, in lifecycle order.',
  })
  statusBreakdown!: DashboardBreakdownDto;

  @ApiProperty({
    type: DashboardBreakdownDto,
    description: 'Unresolved blockers by severity.',
  })
  blockerBreakdown!: DashboardBreakdownDto;

  @ApiProperty({ type: DashboardRankedListDto })
  topProjectsByHours!: DashboardRankedListDto;

  @ApiPropertyOptional({
    type: DashboardRankedListDto,
    nullable: true,
    description:
      'Busiest people in the range. Null for a caller with no business seeing a colleague leaderboard.',
  })
  topContributors!: DashboardRankedListDto | null;

  @ApiProperty({
    type: [DashboardProjectDto],
    description:
      'The project cards, already ordered: active first, then priority, then deadline, then planned start. The browser renders the array as it arrives.',
  })
  projects!: DashboardProjectDto[];

  @ApiProperty({
    example: 22,
    description:
      'How many projects are in the caller scope in total, since projects is a bounded slice of them.',
  })
  projectTotal!: number;

  @ApiProperty({ type: DashboardAttentionDto })
  attention!: DashboardAttentionDto;

  @ApiProperty({ type: DashboardComplianceDto })
  standupComplianceToday!: DashboardComplianceDto;

  @ApiPropertyOptional({
    type: DashboardMyDayDto,
    nullable: true,
    description:
      'Null for a caller who neither tracks time nor files standups, which is every project manager and administrator.',
  })
  myDay!: DashboardMyDayDto | null;
}

/**
 * A CLIENT dashboard.
 *
 * features.md: "A client sees the status and the deadline, and nothing else." So
 * there are no hours, no blockers, no team and no trend here. It is a separate
 * block rather than a scoped WorkspaceDashboardDto, because the difference is not
 * scope: it is that most of those fields must not exist.
 */
export class ClientDashboardDto {
  @ApiProperty({
    type: [DashboardClientProjectDto],
    description: 'The client own projects, never anyone else, already ordered.',
  })
  projects!: DashboardClientProjectDto[];

  @ApiProperty({
    example: 1,
    description:
      'How many are waiting on this client to approve or request changes. The one number a client can act on.',
  })
  awaitingMyFeedbackCount!: number;
}

/**
 * The landing screen.
 *
 * audience says which block is populated, and EXACTLY ONE IS. The other is null.
 *
 * The alternative was a route per audience and a client that works out which one
 * it may call. That is derivation, and deriving it in a browser means a second
 * copy of the rule that decides it (D4, D2). Here the server answers the question
 * it is the authority on, in one round trip, and the client switches on a string.
 */
export class DashboardResponseDto {
  @ApiProperty({
    type: EnumDisplayDto,
    enum: DASHBOARD_AUDIENCES,
    description:
      'Which block below is populated. Decided from the caller permission set, never from their role.',
  })
  audience!: EnumDisplayDto;

  @ApiProperty({
    example: '2026-08-20T10:31:00.000Z',
    description:
      'When these figures were read, on the server clock. A screen showing a relative time measures against this rather than against the browser clock, which is not the clock the numbers came from.',
  })
  generatedAt!: Date;

  @ApiProperty({
    type: DashboardRangeDto,
    description: 'The window every trend and delta covers.',
  })
  range!: DashboardRangeDto;

  @ApiPropertyOptional({
    type: WorkspaceDashboardDto,
    nullable: true,
    description: 'Populated for the ADMIN, MANAGER and STAFF audiences.',
  })
  workspace!: WorkspaceDashboardDto | null;

  @ApiPropertyOptional({
    type: ClientDashboardDto,
    nullable: true,
    description: 'Populated for the CLIENT audience only.',
  })
  client!: ClientDashboardDto | null;
}

// ══════════════════════════════════════════════════════════════════════════
// Query
// ══════════════════════════════════════════════════════════════════════════

export class QueryDashboardDto {
  @ApiPropertyOptional({
    example: 14,
    minimum: 7,
    maximum: 90,
    default: 14,
    description:
      'How many days the trends and deltas cover. Bounded because the delta compares against a window of equal length immediately before this one, so an unbounded range would read years of time entries to draw one chart.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days?: number;
}

// ══════════════════════════════════════════════════════════════════════════
// Request
// ══════════════════════════════════════════════════════════════════════════
//
// None. The dashboard is read only.
