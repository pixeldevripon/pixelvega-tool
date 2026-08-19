import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectDocumentType } from '@prisma/client';

const PROJECT_DOCUMENT_TYPES = Object.values(ProjectDocumentType);

// Sent as multipart/form-data. An accompanying "file" field makes this a
// FILE format document; omitting it requires textContent, making it a TEXT
// format one (e.g. a Credential). Only one of the two is allowed, enforced
// in the service.
export class CreateProjectDocumentDto {
  @ApiProperty({ example: 'Staging server credentials' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: PROJECT_DOCUMENT_TYPES, example: 'CREDENTIAL' })
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
