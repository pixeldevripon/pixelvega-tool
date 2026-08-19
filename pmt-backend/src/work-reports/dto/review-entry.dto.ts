import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewEntryDto {
  @ApiPropertyOptional({ example: 'Good progress, nice work on the tests.' })
  @IsOptional()
  @IsString()
  reviewComment?: string;
}
