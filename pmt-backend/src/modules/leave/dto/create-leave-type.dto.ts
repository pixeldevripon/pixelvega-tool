import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Annual Leave' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(0)
  defaultDaysPerYear!: number;
}
