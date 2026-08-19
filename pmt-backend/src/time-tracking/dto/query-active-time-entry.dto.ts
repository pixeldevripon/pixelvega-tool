import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryActiveTimeEntryDto {
  @ApiPropertyOptional({
    description:
      "Check a specific user's active timer instead of your own — PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN only.",
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
