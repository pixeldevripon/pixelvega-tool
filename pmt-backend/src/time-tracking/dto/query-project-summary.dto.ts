import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryProjectSummaryDto {
  @ApiPropertyOptional({
    description:
      "Whose hours to summarize — defaults to the caller. PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass a different user's id; DEVELOPER/DESIGNER can only view their own.",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-18',
    description:
      'Only entries that started on/after this date (inclusive, whole day). Set both startDate and endDate to today to answer "how many hours did they log today, by project".',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-18',
    description:
      'Only entries that started on/before this date (inclusive, whole day).',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
