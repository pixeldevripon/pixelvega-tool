import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
  'text/csv',
];

// Shared multer config for FILE format ProjectDocument uploads. This has a
// wider mimetype allowlist than imageUploadOptions (images plus common
// office/archive formats) and a larger size cap, since deliverables and
// assets run bigger than an avatar.
export const documentUploadOptions: MulterOptions = {
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (
      !file.mimetype.startsWith('image/') &&
      !ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)
    ) {
      callback(new BadRequestException('Unsupported file type'), false);
      return;
    }
    callback(null, true);
  },
};
