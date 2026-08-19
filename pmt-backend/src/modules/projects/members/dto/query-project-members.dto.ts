import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class QueryProjectMembersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Include members who have left (leftAt set). Off by default, which returns only active members.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeLeft?: boolean = false;
}
