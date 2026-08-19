import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectDocumentType } from '@prisma/client';

const PROJECT_DOCUMENT_TYPES = Object.values(ProjectDocumentType);

// Shared across every file in the batch. Each file becomes its own
// ProjectDocument row, titled after its original filename. For a distinct
// title per file (or a TEXT format document), use POST /documents instead.
export class CreateProjectDocumentsBatchDto {
  @ApiProperty({ enum: PROJECT_DOCUMENT_TYPES, example: 'DELIVERABLE' })
  @IsIn(PROJECT_DOCUMENT_TYPES)
  type!: ProjectDocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
