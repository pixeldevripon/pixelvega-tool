import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

import { EnumDisplayDto } from '@/common/dto/display.dto';

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class StatusReportResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  requestedById!: string;

  @ApiProperty({ example: 'STATUS_UPDATE' })
  reportType!: string;

  @ApiProperty({ description: 'Markdown.' })
  content!: string;

  @ApiProperty({ example: '2026-08-07' })
  periodStart!: string;

  @ApiProperty({ example: '2026-08-13' })
  periodEnd!: string;

  @ApiProperty({
    example: 'claude-sonnet-5',
    description:
      'Which model wrote it. Recorded so a report can be judged against what produced it, and so a model change is visible in the history.',
  })
  model!: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
    description: 'The template that shaped it, if one was in force.',
  })
  templateId!: string | null;

  @ApiProperty({ example: '2026-08-13T09:00:00.000Z' })
  createdAt!: Date;
}

/** A generation request is queued, not answered inline. */
export class QueuedStatusReportResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  jobId!: string;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

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
