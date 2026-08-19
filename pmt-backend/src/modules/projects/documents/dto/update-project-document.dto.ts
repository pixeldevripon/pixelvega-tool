import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Covers metadata only, for both FILE and TEXT format documents. A FILE
// document's underlying upload can't be replaced this way, the same
// reasoning as avatar upload being POST, not PATCH.
export class UpdateProjectDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Only applies to a TEXT format document.',
  })
  @IsOptional()
  @IsString()
  textContent?: string;
}
