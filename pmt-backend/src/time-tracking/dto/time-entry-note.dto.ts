import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Shared body shape for start/pause/resume/stop. All four actions optionally
// attach a note describing that segment of work, so there's no reason for
// four DTOs that are nearly identical.
export class TimeEntryNoteDto {
  @ApiPropertyOptional({ example: 'Fixed the login redirect bug' })
  @IsOptional()
  @IsString()
  notes?: string;
}
