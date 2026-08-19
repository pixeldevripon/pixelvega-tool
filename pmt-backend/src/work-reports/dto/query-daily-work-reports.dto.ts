import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const DAILY_ENTRY_TYPES = ['PLAN', 'WRAP_UP'] as const;
export type DailyEntryTypeFilter = (typeof DAILY_ENTRY_TYPES)[number];

export class QueryDailyWorkReportsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "View a specific team member's reports instead of your own. DEVELOPER/DESIGNER may only view themselves (403 otherwise); PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may view anyone.",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Only reports on/after this date (inclusive). Omit both dates to see all time.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Only reports on/before this date (inclusive).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: DAILY_ENTRY_TYPES,
    description:
      'Within each report, only include entries that have a plan (PLAN) or only entries that have a wrap-up (WRAP_UP). Omit to see both. A report with no entry matching this filter is excluded entirely.',
  })
  @IsOptional()
  @IsIn(DAILY_ENTRY_TYPES)
  type?: DailyEntryTypeFilter;
}
