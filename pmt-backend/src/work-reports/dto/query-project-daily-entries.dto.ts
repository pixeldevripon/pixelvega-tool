import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const DAILY_ENTRY_TYPES = ['PLAN', 'WRAP_UP'] as const;
export type DailyEntryTypeFilter = (typeof DAILY_ENTRY_TYPES)[number];

export class QueryProjectDailyEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter to a specific team member. Omit to see the whole project team combined.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries whose report date is on/after this date (inclusive). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries whose report date is on/before this date (inclusive).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: DAILY_ENTRY_TYPES,
    description:
      'Only entries that have a plan (PLAN) or only entries that have a wrap-up (WRAP_UP). Omit to see both.',
  })
  @IsOptional()
  @IsIn(DAILY_ENTRY_TYPES)
  type?: DailyEntryTypeFilter;
}
