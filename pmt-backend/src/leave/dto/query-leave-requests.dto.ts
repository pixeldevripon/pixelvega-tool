import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class QueryLeaveRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to a specific user' })
  @IsOptional()
  @IsString()
  userId?: string;
}
