import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

const STATUSES = Object.values(ProjectStatus);

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: STATUSES, example: 'ON_HOLD' })
  @IsIn(STATUSES)
  status!: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Required when moving to ON_HOLD or CANCELLED',
    example: 'Waiting on client-supplied assets',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
