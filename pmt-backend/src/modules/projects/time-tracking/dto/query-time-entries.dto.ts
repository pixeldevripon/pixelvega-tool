import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeEntryStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

const TIME_ENTRY_STATUSES = Object.values(TimeEntryStatus);

export class QueryTimeEntriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter to a specific team member — any active project member can use this (matching document/activity visibility elsewhere in this module). Omit to see the whole project team combined.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: TIME_ENTRY_STATUSES })
  @IsOptional()
  @IsIn(TIME_ENTRY_STATUSES)
  status?: TimeEntryStatus;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries that started on/after this date (inclusive, whole day). Combine with endDate for a range, or set both to the same date for a single day.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-17',
    description:
      'Only entries that started on/before this date (inclusive, whole day).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
