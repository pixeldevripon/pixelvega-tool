import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectDocumentType } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

const PROJECT_DOCUMENT_TYPES = Object.values(ProjectDocumentType);

export class QueryProjectDocumentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PROJECT_DOCUMENT_TYPES,
    description:
      'Filter to a single document type. Ignored for a CLIENT caller, who is always restricted to DELIVERABLE regardless of this filter.',
  })
  @IsOptional()
  @IsIn(PROJECT_DOCUMENT_TYPES)
  type?: ProjectDocumentType;

  @ApiPropertyOptional({
    default: false,
    description:
      'Off by default: returns only the newest document per (type, title) group, so uploading a revised PRD under the same title stops older PRDs from cluttering the list. Set true to return every document, including superseded ones.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeHistory?: boolean = false;
}
