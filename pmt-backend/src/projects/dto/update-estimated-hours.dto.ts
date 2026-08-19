import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEstimatedHoursDto {
  @ApiProperty({ example: 40, minimum: 0 })
  @IsNumber()
  @Min(0)
  estimatedHours!: number;
}
