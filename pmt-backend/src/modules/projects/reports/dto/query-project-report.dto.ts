import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryProjectReportDto {
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
