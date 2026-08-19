import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

import { EnumDisplayDto } from '@/common/dto/display.dto';

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════
//
// These endpoints are the clearest case for D4 in the codebase: every figure
// here is an aggregate that a client must never recompute, because two clients
// computing "plan follow through rate" from raw rows would eventually disagree
// about which rows count.
//
// A rate is null, never zero, when its denominator is zero. Zero would claim a
// measured result of nothing; null says the question does not apply. That
// distinction is load bearing on an empty date range.

export class ReportRangeDto {
  @ApiProperty({ example: '2026-08-01', description: 'Inclusive.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-31', description: 'Inclusive.' })
  endDate!: string;
}

export class RosterMemberDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ type: EnumDisplayDto })
  role!: EnumDisplayDto;
}

export class MemberHoursDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({
    example: 42.17,
    description: 'Hours at 2dp. Arrives sorted heaviest first (D4).',
  })
  hours!: number;
}

export class StatusChangeDto {
  @ApiProperty({ example: '2026-08-14T11:02:00.000Z' })
  changedAt!: Date;

  @ApiPropertyOptional({ type: EnumDisplayDto, nullable: true })
  from!: EnumDisplayDto | null;

  @ApiPropertyOptional({ type: EnumDisplayDto, nullable: true })
  to!: EnumDisplayDto | null;
}

export class StaffingChangesDto {
  @ApiProperty({ type: [String], example: ['Rezina Akter'] })
  joined!: string[];

  @ApiProperty({ type: [String], example: [] })
  left!: string[];
}

export class SeverityCountsDto {
  @ApiProperty({ example: 1 })
  LOW!: number;

  @ApiProperty({ example: 2 })
  MEDIUM!: number;

  @ApiProperty({ example: 0 })
  HIGH!: number;
}

export class ReportBlockersDto {
  @ApiProperty({ example: 3, description: 'Opened in range, by createdAt.' })
  openedCount!: number;

  @ApiProperty({ example: 2, description: 'Resolved in range, by resolvedAt.' })
  resolvedCount!: number;

  @ApiProperty({ type: SeverityCountsDto })
  openedBySeverity!: SeverityCountsDto;

  @ApiProperty({ type: SeverityCountsDto })
  resolvedBySeverity!: SeverityCountsDto;

  @ApiPropertyOptional({
    example: 1440,
    nullable: true,
    description: 'Null when nothing was resolved in range.',
  })
  averageResolutionMinutes!: number | null;

  @ApiProperty({
    example: 1,
    description: 'Open right now, regardless of range.',
  })
  currentlyOpenCount!: number;

  @ApiPropertyOptional({ example: 3.5, nullable: true })
  currentlyOpenAverageDaysOpen!: number | null;

  @ApiProperty({
    example: 1,
    description:
      "How many resolved blockers pushed the project's deadline out.",
  })
  deadlineExtensionCount!: number;
}

export class ReportAdditionalRequirementsDto {
  @ApiProperty({ example: 4, description: 'Received in range, by createdAt.' })
  receivedCount!: number;

  @ApiProperty({ example: 3, description: 'Approved in range, by reviewedAt.' })
  approvedCount!: number;

  @ApiProperty({ example: 1 })
  rejectedCount!: number;

  @ApiProperty({ example: 16 })
  totalApprovedAdditionalHours!: number;

  @ApiProperty({ example: 5 })
  totalDeadlineExtensionDays!: number;
}

export class ReportInternalReviewDto {
  @ApiProperty({ example: 1 })
  approvedCount!: number;

  @ApiProperty({ example: 2 })
  changesRequiredCount!: number;
}

export class ReportClientFeedbackDto {
  @ApiProperty({ example: 1 })
  approvedCount!: number;

  @ApiProperty({ example: 1 })
  changesRequestedCount!: number;
}

export class WorkReportComplianceDto {
  @ApiProperty({ example: 18 })
  daysPlanned!: number;

  @ApiProperty({ example: 16 })
  daysWrappedUp!: number;

  @ApiPropertyOptional({
    example: 0.89,
    nullable: true,
    description:
      'daysWrappedUp / daysPlanned. Null when nothing was planned, because the question does not apply.',
  })
  planFollowThroughRate!: number | null;

  @ApiPropertyOptional({
    example: 0.82,
    nullable: true,
    description:
      'daysPlanned / workingDaysInRange. KNOWN LIMITATION: for a team of more than one active member this can exceed 1, since daysPlanned is summed across everyone while the denominator is not multiplied by roster size. That is the formula as specified, left visible rather than silently corrected.',
  })
  planningCoverageRate!: number | null;
}

export class ProjectReportResponseDto {
  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({ type: EnumDisplayDto })
  priority!: EnumDisplayDto;

  @ApiPropertyOptional({ example: 120, nullable: true })
  estimatedHours!: number | null;

  @ApiProperty({ example: 84.5 })
  actualHours!: number;

  @ApiPropertyOptional({
    example: 35.5,
    nullable: true,
    description:
      'estimatedHours minus actualHours. Null when there is no estimate, and NEGATIVE when overrun, never clamped to zero.',
  })
  remainingHours!: number | null;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', nullable: true })
  plannedStartDate!: Date | null;

  @ApiPropertyOptional({ example: '2026-09-30T00:00:00.000Z', nullable: true })
  deadline!: Date | null;

  @ApiProperty({ type: [RosterMemberDto] })
  roster!: RosterMemberDto[];

  @ApiProperty({
    example: true,
    description:
      'Whether internal review round 1 was an approval. A fixed fact about the project.',
  })
  internalReviewFirstRoundApproved!: boolean;

  @ApiProperty({ example: false })
  clientFeedbackFirstRoundApproved!: boolean;

  @ApiProperty({ type: ReportRangeDto })
  range!: ReportRangeDto;

  @ApiProperty({ type: [MemberHoursDto] })
  hoursByMember!: MemberHoursDto[];

  @ApiProperty({ type: [StatusChangeDto] })
  statusChanges!: StatusChangeDto[];

  @ApiProperty({ type: StaffingChangesDto })
  staffingChanges!: StaffingChangesDto;

  @ApiProperty({ type: ReportBlockersDto })
  blockers!: ReportBlockersDto;

  @ApiProperty({ type: ReportAdditionalRequirementsDto })
  additionalRequirements!: ReportAdditionalRequirementsDto;

  @ApiProperty({ type: ReportInternalReviewDto })
  internalReview!: ReportInternalReviewDto;

  @ApiProperty({ type: ReportClientFeedbackDto })
  clientFeedback!: ReportClientFeedbackDto;

  @ApiProperty({
    example: 22,
    description: 'Weekdays in range, minus company holidays.',
  })
  workingDaysInRange!: number;

  @ApiProperty({ type: WorkReportComplianceDto })
  dailyWorkReportCompliance!: WorkReportComplianceDto;
}

export class ProjectHoursDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiPropertyOptional({ example: 'Acme corporate site', nullable: true })
  projectName!: string | null;

  @ApiProperty({ example: 900 })
  totalMinutes!: number;

  @ApiProperty({ example: 15 })
  totalHours!: number;

  @ApiProperty({ example: '15h' })
  totalLabel!: string;
}

export class DayHoursDto {
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

export class ProjectTouchedDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiPropertyOptional({ example: 'Acme corporate site', nullable: true })
  projectName!: string | null;

  @ApiProperty({
    example: true,
    description:
      'Whether they are still staffed on it. False means they worked on it during the range and have since left.',
  })
  active!: boolean;
}

export class DeveloperReportResponseDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  userId!: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Set when the report was narrowed to one project.',
  })
  projectId!: string | null;

  @ApiProperty({ type: ReportRangeDto })
  range!: ReportRangeDto;

  @ApiProperty({ example: 128.5 })
  projectHours!: number;

  @ApiProperty({ example: 12 })
  meetingHours!: number;

  @ApiProperty({ example: 140.5 })
  totalHours!: number;

  @ApiProperty({ type: [ProjectHoursDto] })
  hoursByProject!: ProjectHoursDto[];

  @ApiProperty({ type: [DayHoursDto] })
  hoursByDay!: DayHoursDto[];

  @ApiProperty({ example: 22 })
  workingDaysInRange!: number;

  @ApiPropertyOptional({
    example: 0.8,
    nullable: true,
    description:
      'totalHours against the target for the working days in range. Null when the range contains no working days.',
  })
  hoursGoalRate!: number | null;

  @ApiProperty({ type: WorkReportComplianceDto })
  dailyWorkReportCompliance!: WorkReportComplianceDto;

  @ApiProperty({ example: 4 })
  blockersReported!: number;

  @ApiProperty({ example: 3 })
  blockersResolved!: number;

  @ApiPropertyOptional({ example: 1440, nullable: true })
  averageResolutionMinutes!: number | null;

  @ApiProperty({
    example: 2,
    description:
      'Company wide, never project scoped: leave is not a project concept.',
  })
  leaveDaysTaken!: number;

  @ApiProperty({ type: [ProjectTouchedDto] })
  projectsTouched!: ProjectTouchedDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class QueryProjectReportDto {
  @ApiProperty({
    example: '2026-08-01',
    description: 'Start of the report range (inclusive).',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2026-08-31',
    description: 'End of the report range (inclusive).',
  })
  @IsDateString()
  endDate!: string;
}

export class QueryDeveloperReportDto {
  @ApiPropertyOptional({
    description:
      "Whose report to build, defaults to the caller. DEVELOPER and DESIGNER can only view their own; PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description:
      "Narrow the whole report to one project instead of this person's activity across every project. When set, hoursByProject, hoursByDay, blockers and dailyWorkReportCompliance all scope to just this project. leaveDaysTaken, hoursGoalRate and workingDaysInRange stay company wide either way, since leave and working day math are not project specific concepts.",
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    example: '2026-08-01',
    description: 'Start of the report range (inclusive).',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2026-08-31',
    description: 'End of the report range (inclusive).',
  })
  @IsDateString()
  endDate!: string;
}
