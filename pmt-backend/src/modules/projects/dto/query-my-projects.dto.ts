import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryMyProjectsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Off by default, which returns only non archived projects. Set to true to view only archived projects, a dedicated archive view rather than a mix of both. Ignored for a CLIENT caller.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean = false;
}
