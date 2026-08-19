import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({ example: 'Annual Leave' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDaysPerYear?: number;
}
