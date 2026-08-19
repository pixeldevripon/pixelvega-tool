import {
  ProjectDocument,
  ProjectDocumentFormat,
  ProjectDocumentType,
  User,
} from '@prisma/client';

import {
  PROJECT_DOCUMENT_FORMAT_DISPLAY,
  PROJECT_DOCUMENT_TYPE_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';
import { formatFileSize } from '@/common/utils/file-size.util';
import {
  ProjectDocumentDetailResponseDto,
  ProjectDocumentResponseDto,
  SupersededByDto,
} from './dto/project-document.dto';

/** Exactly what `DOCUMENT_INCLUDE` in the service produces. */
export type ProjectDocumentWithUploader = ProjectDocument & {
  uploadedBy: Pick<User, 'id' | 'name' | 'email'>;
};

/**
 * Whether the caller manages the project.
 *
 * That single fact decides both mutating capabilities, so it is asked once per
 * request by the service and passed in, keeping this file free of a database.
 */
export type ProjectDocumentContext = {
  managesProject: boolean;
};

export function toProjectDocumentResponse(
  document: ProjectDocumentWithUploader,
  context: ProjectDocumentContext,
): ProjectDocumentResponseDto {
  return {
    id: document.id,
    projectId: document.projectId,
    title: document.title,
    description: document.description,
    type: toEnumDisplay(PROJECT_DOCUMENT_TYPE_DISPLAY, document.type),
    format: toEnumDisplay(PROJECT_DOCUMENT_FORMAT_DISPLAY, document.format),
    fileUrl: document.fileUrl,
    fileMimeType: document.fileMimeType,
    fileSizeBytes: document.fileSizeBytes,
    fileSizeLabel: formatFileSize(document.fileSizeBytes),
    textContent: document.textContent,
    uploadedBy: {
      id: document.uploadedBy.id,
      name: document.uploadedBy.name,
      email: document.uploadedBy.email,
    },
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    capabilities: {
      canEdit: context.managesProject,
      canDelete: context.managesProject,
      // Not an authorization question. Anyone who can read the document can
      // download it; a TEXT document simply has no file to download.
      canDownload: document.fileUrl !== null,
    },
  };
}

export function toProjectDocumentDetailResponse(
  document: ProjectDocumentWithUploader,
  supersededBy: SupersededByDto | null,
  context: ProjectDocumentContext,
): ProjectDocumentDetailResponseDto {
  return { ...toProjectDocumentResponse(document, context), supersededBy };
}
