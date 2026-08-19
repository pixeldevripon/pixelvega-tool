import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStatusReportDto {
  @ApiPropertyOptional({
    example: '2026-08-07',
    description:
      "Start of the period this report covers (inclusive). Defaults to the day after this project's last status report, or seven days ago if it has never had one.",
  })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({
    example: '2026-08-13',
    description:
      'End of the period this report covers (inclusive). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
