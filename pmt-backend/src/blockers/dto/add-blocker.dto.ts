import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockerSeverity } from '@prisma/client';

// Can be reported anytime, by anyone active on the project. It is completely
// independent of that day's DailyWorkReport.
export class AddBlockerDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'DB schema not approved, blocking all API work',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    enum: BlockerSeverity,
    default: BlockerSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(BlockerSeverity)
  severity?: BlockerSeverity;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Defaults to the "Unspecified" reason if omitted.',
  })
  @IsOptional()
  @IsUUID()
  reasonId?: string;
}
