import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectPriority } from '@prisma/client';

const PRIORITIES = Object.values(ProjectPriority);

export class UpdateProjectPriorityDto {
  @ApiProperty({ enum: PRIORITIES, example: 'URGENT' })
  @IsIn(PRIORITIES)
  priority!: ProjectPriority;

  @ApiPropertyOptional({
    description: 'Required when priority is URGENT or CRITICAL',
    example: 'Client escalated via phone call',
  })
  @IsOptional()
  @IsString()
  rushReason?: string;
}
