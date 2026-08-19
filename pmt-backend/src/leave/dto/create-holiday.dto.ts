import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Eid-ul-Fitr' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2026-03-19' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    example: '2026-03-21',
    description: 'Omit for a single-day holiday — defaults to startDate',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
