import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlockerReasonDto {
  @ApiProperty({ example: 'Technical' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
