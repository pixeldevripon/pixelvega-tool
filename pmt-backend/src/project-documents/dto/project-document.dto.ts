import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ProjectDocumentType } from '@prisma/client';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import { ToBoolean } from '@/common/decorators/to-boolean.decorator';

const PROJECT_DOCUMENT_TYPES = Object.values(ProjectDocumentType);

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class DocumentUploaderDto {
  @ApiProperty({ example: 'FKlPeooYonpdtm6IW7eJkJJvA4sdr2Xg' })
  id!: string;

  @ApiProperty({ example: 'Rezina Akter' })
  name!: string;

  @ApiProperty({ example: 'rezina@pixelvega.com' })
  email!: string;
}

/**
 * The newer document that replaced this one, when there is one.
 *
 * Documents are versioned by (type, title): uploading a revised PRD under the
 * same title supersedes the old one rather than editing it. A reader looking at
 * an old revision needs to be told, which is what this field is for.
 */
export class SupersededByDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Acme PRD' })
  title!: string;

  @ApiProperty({ example: '2026-08-12T09:00:00.000Z' })
  createdAt!: Date;
}

export class ProjectDocumentCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      "Whether this caller may edit the document's metadata. Managing the project is the rule.",
  })
  canEdit!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether this caller may remove the document (a soft delete).',
  })
  canDelete!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether this document has a stored file to download. False for a TEXT format document, which has textContent instead.',
  })
  canDownload!: boolean;
}

export class ProjectDocumentResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  projectId!: string;

  @ApiProperty({ example: 'Staging server credentials' })
  title!: string;

  @ApiPropertyOptional({ example: 'Rotated on every deploy.', nullable: true })
  description!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  type!: EnumDisplayDto;

  @ApiProperty({ type: EnumDisplayDto })
  format!: EnumDisplayDto;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/pixelvega/raw/upload/v1/pmt/acme-prd.pdf',
    nullable: true,
    description: 'FILE format only.',
  })
  fileUrl!: string | null;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  fileMimeType!: string | null;

  @ApiPropertyOptional({
    example: 1572864,
    nullable: true,
    description:
      'The exact size in bytes. Use this for any comparison or total; use fileSizeLabel to display (ADR 0003).',
  })
  fileSizeBytes!: number | null;

  @ApiPropertyOptional({
    example: '1.5 MB',
    nullable: true,
    description:
      'The size, ready to render. Served because two clients would otherwise implement the same binary unit arithmetic and disagree about it (D4).',
  })
  fileSizeLabel!: string | null;

  @ApiPropertyOptional({
    example: 'user: deploy@acme.com',
    nullable: true,
    description: 'TEXT format only.',
  })
  textContent!: string | null;

  @ApiProperty({ type: DocumentUploaderDto })
  uploadedBy!: DocumentUploaderDto;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: ProjectDocumentCapabilitiesDto })
  capabilities!: ProjectDocumentCapabilitiesDto;
}

/** `findOne` adds the revision pointer; a list does not. */
export class ProjectDocumentDetailResponseDto extends ProjectDocumentResponseDto {
  @ApiPropertyOptional({
    type: SupersededByDto,
    nullable: true,
    description:
      'The newer document under the same (type, title). Null when this is the current revision.',
  })
  supersededBy!: SupersededByDto | null;
}

export class PaginatedProjectDocumentsResponseDto {
  @ApiProperty({ type: [ProjectDocumentResponseDto] })
  items!: ProjectDocumentResponseDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class RemoveProjectDocumentResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({
    example: true,
    description:
      'Always true. A failure arrives as an error status, not as false.',
  })
  removed!: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

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
  @ToBoolean()
  @IsBoolean()
  includeHistory?: boolean = false;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

// Sent as multipart/form-data. An accompanying "file" field makes this a
// FILE format document; omitting it requires textContent, making it a TEXT
// format one (e.g. a Credential). Only one of the two is allowed, enforced
// in the service.
export class CreateProjectDocumentDto {
  @ApiProperty({ example: 'Staging server credentials' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    enum: PROJECT_DOCUMENT_TYPES,
    example: ProjectDocumentType.CREDENTIAL,
  })
  @IsIn(PROJECT_DOCUMENT_TYPES)
  type!: ProjectDocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Required when no file is uploaded. Makes this a TEXT format document (e.g. a Credential).',
  })
  @IsOptional()
  @IsString()
  textContent?: string;
}

// Shared across every file in the batch. Each file becomes its own
// ProjectDocument row, titled after its original filename. For a distinct
// title per file (or a TEXT format document), use POST /documents instead.
export class CreateProjectDocumentsBatchDto {
  @ApiProperty({
    enum: PROJECT_DOCUMENT_TYPES,
    example: ProjectDocumentType.DELIVERABLE,
  })
  @IsIn(PROJECT_DOCUMENT_TYPES)
  type!: ProjectDocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

// Covers metadata only, for both FILE and TEXT format documents. A FILE
// document's underlying upload can't be replaced this way, the same
// reasoning as avatar upload being POST, not PATCH.
export class UpdateProjectDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Only applies to a TEXT format document.',
  })
  @IsOptional()
  @IsString()
  textContent?: string;
}
