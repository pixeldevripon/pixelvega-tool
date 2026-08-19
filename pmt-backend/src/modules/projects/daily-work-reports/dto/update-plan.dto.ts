import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DailyProjectEntryPlanDto } from './submit-plan.dto';

export class UpdatePlanDto {
  @ApiProperty({ type: [DailyProjectEntryPlanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyProjectEntryPlanDto)
  entries!: DailyProjectEntryPlanDto[];
}
