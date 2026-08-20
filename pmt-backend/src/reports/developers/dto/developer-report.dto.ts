import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

import * as FieldLength from '@/common/constants/field-lengths';
import { IsNotBefore } from '@/common/validators/is-not-before.validator';
import {
  ReportRangeDto,
  WorkReportComplianceDto,
} from '@/common/dto/report-values.dto';

// ══════════════════════════════════════════════════════════════════════════
// Response
// ══════════════════════════════════════════════════════════════════════════
//
// Every figure here is an aggregate the client must never recompute: two
// clients deriving "plan follow through rate" from raw rows would eventually
// disagree about which rows count.
//
// A rate is null, never zero, when its denominator is zero. Zero would claim
// a measured result of nothing; null says the question does not apply.

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

// ══════════════════════════════════════════════════════════════════════════
// Query
// ══════════════════════════════════════════════════════════════════════════

export class QueryDeveloperReportDto {
  @ApiPropertyOptional({
    description:
      "Whose report to build, defaults to the caller. DEVELOPER and DESIGNER can only view their own; PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
  userId?: string;

  @ApiPropertyOptional({
    description:
      "Narrow the whole report to one project instead of this person's activity across every project. When set, hoursByProject, hoursByDay, blockers and dailyWorkReportCompliance all scope to just this project. leaveDaysTaken, hoursGoalRate and workingDaysInRange stay company wide either way, since leave and working day math are not project specific concepts.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.SINGLE_LINE)
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
  @IsNotBefore('startDate')
  endDate!: string;
}
