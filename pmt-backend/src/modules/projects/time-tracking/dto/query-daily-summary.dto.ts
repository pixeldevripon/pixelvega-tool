import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Cross-project, cross-meeting: backs the combined GET
// /time-entries/daily-summary, not the project scoped
// GET /projects/:projectId/time-entries/daily-summary (which reuses
// QueryTimeEntriesDto instead). Same shape as QueryProjectSummaryDto, no
// status filter since this sums both project and meeting time together.
export class QueryDailySummaryDto {
  @ApiPropertyOptional({
    description:
      "Whose day-by-day hours to show, defaults to the caller. DEVELOPER/DESIGNER can only view their own; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
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
