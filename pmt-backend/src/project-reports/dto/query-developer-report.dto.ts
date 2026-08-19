import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDeveloperReportDto {
  @ApiPropertyOptional({
    description:
      "Whose report to build, defaults to the caller. DEVELOPER/DESIGNER can only view their own; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description:
      "Narrow the whole report to one project instead of this person's activity across every project. When set, hoursByProject/hoursByDay/blockers/dailyWorkReportCompliance all scope to just this project. leaveDaysTaken, hoursGoalRate, and workingDaysInRange stay company wide either way, since leave and working day math are not project specific concepts.",
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
