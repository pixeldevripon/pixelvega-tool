import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryProjectAiSummaryDto {
  @ApiProperty({
    example: '2026-08-01',
    description:
      'Start of the window to pull reported accomplishments from (inclusive).',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2026-08-31',
    description:
      'End of the window to pull reported accomplishments from (inclusive).',
  })
  @IsDateString()
  endDate!: string;
}
