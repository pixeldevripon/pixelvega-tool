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

// projectId may or may not have appeared in the morning plan. A wrap up can
// include projects that weren't planned (e.g. unplanned or urgent work).
export class DailyProjectEntryWrapUpDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'Completed auth module, 95% done\n- Unit tests passing',
  })
  @IsString()
  @IsNotEmpty()
  accomplishments!: string;
}

export class SubmitWrapUpDto {
  @ApiProperty({ type: [DailyProjectEntryWrapUpDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryWrapUpDto)
  entries!: DailyProjectEntryWrapUpDto[];
}
