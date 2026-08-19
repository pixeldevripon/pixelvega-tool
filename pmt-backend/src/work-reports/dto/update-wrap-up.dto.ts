import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DailyProjectEntryWrapUpDto } from './submit-wrap-up.dto';

export class UpdateWrapUpDto {
  @ApiProperty({ type: [DailyProjectEntryWrapUpDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryWrapUpDto)
  entries!: DailyProjectEntryWrapUpDto[];
}
