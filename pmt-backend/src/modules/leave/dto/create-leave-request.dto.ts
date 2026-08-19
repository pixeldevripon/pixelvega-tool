import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-12' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: 'Family event' })
  @IsOptional()
  @IsString()
  reason?: string;
}
