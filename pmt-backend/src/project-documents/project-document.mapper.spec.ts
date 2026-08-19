import { ProjectDocumentFormat, ProjectDocumentType } from '@prisma/client';

import {
  ProjectDocumentWithUploader,
  toProjectDocumentDetailResponse,
  toProjectDocumentResponse,
} from './project-document.mapper';

const AT = new Date('2026-08-01T09:00:00.000Z');

function doc(
  overrides: Partial<ProjectDocumentWithUploader> = {},
): ProjectDocumentWithUploader {
  return {
    id: 'd1',
    projectId: 'p1',
    title: 'Acme PRD',
    description: null,
    type: ProjectDocumentType.PRD,
    format: ProjectDocumentFormat.FILE,
    fileUrl: 'https://res.cloudinary.com/pixelvega/raw/upload/v1/acme-prd.pdf',
    fileMimeType: 'application/pdf',
    fileSizeBytes: 1572864,
    textContent: null,
    uploadedById: 'u1',
    createdAt: AT,
    updatedAt: AT,
    deletedAt: null,
    uploadedBy: {
      id: 'u1',
      name: 'Rezina Akter',
      email: 'rezina@pixelvega.com',
    },
    ...overrides,
  };
}

const MANAGER = { managesProject: true };
const NOT_MANAGER = { managesProject: false };

describe('toProjectDocumentResponse', () => {
  it('returns type and format as display objects', () => {
    const result = toProjectDocumentResponse(doc(), MANAGER);
    expect(result.type).toEqual({
      value: 'PRD',
      label: 'PRD',
      tone: 'default',
    });
    expect(result.format).toEqual({
      value: 'FILE',
      label: 'File',
      tone: 'default',
    });
  });

  it('tones a credential as a warning, because the row holds secrets', () => {
    const result = toProjectDocumentResponse(
      doc({ type: ProjectDocumentType.CREDENTIAL }),
      MANAGER,
    );
    expect(result.type.tone).toBe('warning');
  });

  describe('file size', () => {
    it('carries the exact bytes and a rendered label side by side', () => {
      // ADR 0003: the exact value is what anything may compute with, and the
      // label is only ever read.
      const result = toProjectDocumentResponse(doc(), MANAGER);
      expect(result.fileSizeBytes).toBe(1572864);
      expect(result.fileSizeLabel).toBe('1.5 MB');
    });

    it('leaves both null for a TEXT document', () => {
      const result = toProjectDocumentResponse(
        doc({
          format: ProjectDocumentFormat.TEXT,
          fileUrl: null,
          fileMimeType: null,
          fileSizeBytes: null,
          textContent: 'user: deploy@acme.com',
        }),
        MANAGER,
      );
      expect(result.fileSizeBytes).toBeNull();
      expect(result.fileSizeLabel).toBeNull();
    });
  });

  describe('capabilities', () => {
    it('grants edit and delete to a project manager', () => {
      expect(toProjectDocumentResponse(doc(), MANAGER).capabilities).toEqual({
        canEdit: true,
        canDelete: true,
        canDownload: true,
      });
    });

    it('withholds edit and delete from a reader who does not manage the project', () => {
      const result = toProjectDocumentResponse(doc(), NOT_MANAGER);
      expect(result.capabilities.canEdit).toBe(false);
      expect(result.capabilities.canDelete).toBe(false);
    });

    it('still allows the download for a non manager', () => {
      // Downloading is not an authorization question at this point: reaching
      // this row at all already required passing the read scope check.
      expect(
        toProjectDocumentResponse(doc(), NOT_MANAGER).capabilities.canDownload,
      ).toBe(true);
    });

    it('refuses the download for a TEXT document, which has no file', () => {
      const result = toProjectDocumentResponse(
        doc({ format: ProjectDocumentFormat.TEXT, fileUrl: null }),
        MANAGER,
      );
      expect(result.capabilities.canDownload).toBe(false);
    });
  });
});

describe('toProjectDocumentDetailResponse', () => {
  it('carries a null revision pointer when this is the current one', () => {
    expect(
      toProjectDocumentDetailResponse(doc(), null, MANAGER).supersededBy,
    ).toBeNull();
  });

  it('names the newer revision when this one has been replaced', () => {
    const newer = { id: 'd2', title: 'Acme PRD', createdAt: new Date() };
    const result = toProjectDocumentDetailResponse(doc(), newer, MANAGER);
    expect(result.supersededBy).toBe(newer);
    // The rest of the document is unchanged by having been superseded.
    expect(result.id).toBe('d1');
  });
});
