import { BadRequestException } from '@nestjs/common';

import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  MAX_BATCH_UPLOAD_FILES,
  anyFileUploadOptions,
  documentUploadOptions,
  imageUploadOptions,
  isAllowedMimeType,
  uploadOptions,
} from '../upload-options';

describe('isAllowedMimeType', () => {
  it('accepts anything when no list is given', () => {
    // Omitting the list is how a caller says "any file", rather than passing a
    // list that would have to stay exhaustive forever.
    expect(isAllowedMimeType('application/x-anything')).toBe(true);
    expect(isAllowedMimeType('application/x-anything', [])).toBe(true);
  });

  it('treats a trailing slash as a category prefix', () => {
    expect(isAllowedMimeType('image/png', ['image/'])).toBe(true);
    expect(isAllowedMimeType('image/svg+xml', ['image/'])).toBe(true);
    expect(isAllowedMimeType('video/mp4', ['image/'])).toBe(false);
  });

  it('treats an entry without a slash suffix as an exact match', () => {
    expect(isAllowedMimeType('application/pdf', ['application/pdf'])).toBe(
      true,
    );
    // The bug a naive startsWith would have: application/pdf-evil must not pass
    // because it begins with an allowed exact type.
    expect(isAllowedMimeType('application/pdf-evil', ['application/pdf'])).toBe(
      false,
    );
  });

  it('accepts when any one entry matches', () => {
    expect(isAllowedMimeType('application/zip', DOCUMENT_TYPES)).toBe(true);
    expect(isAllowedMimeType('video/mp4', DOCUMENT_TYPES)).toBe(true);
  });

  it('keeps executables out of the document allowlist', () => {
    // The list exists to exclude these, not to curate formats.
    for (const dangerous of [
      'application/x-msdownload',
      'application/x-sh',
      'application/vnd.microsoft.portable-executable',
      'application/x-executable',
    ]) {
      expect(isAllowedMimeType(dangerous, DOCUMENT_TYPES)).toBe(false);
    }
  });
});

describe('uploadOptions', () => {
  function filterOf(options: ReturnType<typeof uploadOptions>) {
    return options.fileFilter as (
      req: unknown,
      file: { mimetype: string },
      cb: (error: Error | null, accept: boolean) => void,
    ) => void;
  }

  it('converts the size cap from megabytes to bytes', () => {
    expect(uploadOptions({ maxSizeMb: 3 }).limits?.fileSize).toBe(
      3 * 1024 * 1024,
    );
  });

  it('accepts an allowed type', () => {
    const cb = jest.fn();
    filterOf(uploadOptions({ maxSizeMb: 5, allow: IMAGE_TYPES }))(
      {},
      { mimetype: 'image/png' },
      cb,
    );
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('refuses a disallowed type, naming it', () => {
    // "Unsupported file type" alone leaves someone uploading five files
    // guessing which one was the problem.
    const cb = jest.fn();
    filterOf(uploadOptions({ maxSizeMb: 5, allow: IMAGE_TYPES }))(
      {},
      { mimetype: 'application/x-msdownload' },
      cb,
    );
    const [error, accepted] = cb.mock.calls[0] as [
      BadRequestException,
      boolean,
    ];
    expect(accepted).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toContain('application/x-msdownload');
  });
});

describe('the preset option sets', () => {
  it('caps an avatar smaller than a document', () => {
    // An avatar is a thumbnail; a deliverable can be an archive.
    expect(imageUploadOptions.limits?.fileSize).toBe(5 * 1024 * 1024);
    expect(documentUploadOptions.limits?.fileSize).toBe(25 * 1024 * 1024);
  });

  it('leaves the generic preset unrestricted by type but still size capped', () => {
    expect(anyFileUploadOptions.limits?.fileSize).toBe(25 * 1024 * 1024);
  });

  it('bounds a batch, so a caller cannot buffer unlimited files into memory', () => {
    expect(MAX_BATCH_UPLOAD_FILES).toBeGreaterThan(0);
    expect(MAX_BATCH_UPLOAD_FILES).toBeLessThanOrEqual(20);
  });
});
