import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBlockerReasonDto {
  @ApiPropertyOptional({ example: 'Technical Issue' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
