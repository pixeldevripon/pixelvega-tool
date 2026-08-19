import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateHolidayDto {
  @ApiPropertyOptional({ example: 'Eid-ul-Fitr' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '2026-03-19' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-21' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
