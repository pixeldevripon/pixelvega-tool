import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeEntryStatus } from '@prisma/client';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const TIME_ENTRY_STATUSES = Object.values(TimeEntryStatus);

// Same shape as QueryTimeEntriesDto, minus anything project scoped, there is
// no projectId here to filter by.
export class QueryMeetingTimeEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Whose meeting entries to list, defaults to the caller. DEVELOPER/DESIGNER can only list their own; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can pass anyone's userId.",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: TIME_ENTRY_STATUSES })
  @IsOptional()
  @IsIn(TIME_ENTRY_STATUSES)
  status?: TimeEntryStatus;

  @ApiPropertyOptional({
    example: '2026-08-05',
    description:
      'Only entries that started on/after this date (inclusive, whole day). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-05',
    description:
      'Only entries that started on/before this date (inclusive, whole day).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
