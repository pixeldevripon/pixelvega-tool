import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectLeaveRequestDto {
  @ApiPropertyOptional({ example: 'Team is short-staffed that week' })
  @IsOptional()
  @IsString()
  reason?: string;
}
