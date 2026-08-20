import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Response value objects shared by the two report domains: the project
// report at `projects/:projectId/reports` and the developer report at
// `reports/developers`. They live here rather than in either module so
// neither has to import the other's DTO file for a shape that belongs to
// both, which is what kept `reports/developers` depending on the module it
// was extracted from.

export class ReportRangeDto {
  @ApiProperty({ example: '2026-08-01', description: 'Inclusive.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-31', description: 'Inclusive.' })
  endDate!: string;
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
      'daysPlanned / workingDaysInRange for the developer report; daysPlanned / workingDays.average for the project report, since each active member can have a different weeklyOffDay. KNOWN LIMITATION on the project report: for a team of more than one active member this can exceed 1, since daysPlanned is summed across everyone while the denominator is not multiplied by roster size. That is the formula as specified, left visible rather than silently corrected.',
  })
  planningCoverageRate!: number | null;
}
