import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

import { EnumDisplayDto } from '@/common/dto/display.dto';
import { IsNotBefore } from '@/common/validators/is-not-before.validator';
import {
  ReportRangeDto,
  WorkReportComplianceDto,
} from '@/common/dto/report-values.dto';

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
  @IsNotBefore('startDate')
  endDate!: string;
}
