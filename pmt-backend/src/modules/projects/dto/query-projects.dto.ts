import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectPriority, ProjectStatus, ProjectType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const STATUSES = Object.values(ProjectStatus);
const PRIORITIES = Object.values(ProjectPriority);
const PROJECT_TYPES = Object.values(ProjectType);

export class QueryProjectsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: ProjectPriority;

  @ApiPropertyOptional({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  @ApiPropertyOptional({
    enum: PROJECT_TYPES,
    isArray: true,
    example: ['WORDPRESS', 'SEO'],
    description:
      'Comma-separated (?projectTypes=WORDPRESS,SEO) or repeated (?projectTypes=WORDPRESS&projectTypes=SEO). Matches projects tagged with ANY of the given types, not all of them.',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @IsArray()
  @IsIn(PROJECT_TYPES, { each: true })
  projectTypes?: ProjectType[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Off by default, which returns only non archived projects. Set to true to view only archived projects, a dedicated archive view rather than a mix of both.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean = false;

  @ApiPropertyOptional({
    example: 'Acme Website Redesign',
    description:
      'Case insensitive, matches anywhere in the project name. Meant for finding one specific project by name at scale, e.g. inside the archive view above.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;
}
