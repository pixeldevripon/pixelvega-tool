import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DailyProjectEntryPlanDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'Finish auth module\n- Wire up refresh tokens\n- Write unit tests',
  })
  @IsString()
  @IsNotEmpty()
  plan!: string;
}

export class SubmitPlanDto {
  @ApiProperty({ type: [DailyProjectEntryPlanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryPlanDto)
  entries!: DailyProjectEntryPlanDto[];
}
