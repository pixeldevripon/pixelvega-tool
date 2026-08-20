import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MB = 1024 * 1024;

/**
 * How many files one batch endpoint accepts.
 *
 * A cap is required: `FilesInterceptor` with no maximum buffers however many
 * files a caller sends into memory at once.
 */
export const MAX_BATCH_UPLOAD_FILES = 10;

export interface UploadRules {
  /** Size cap per file, in megabytes. */
  maxSizeMb: number;
  /**
   * Which mimetypes to accept.
   *
   * Each entry is either an exact type (`application/pdf`) or a category
   * prefix (`image/`, `video/`). Omit to accept anything, which is what the
   * generic `anyFileUpload` below does.
   */
  allow?: readonly string[];
}

/** Images only. Avatars, and anything else that must render as a picture. */
export const IMAGE_TYPES = ['image/'] as const;

/**
 * Everything a project document can be.
 *
 * Deliberately broad: a deliverable is whatever the client asked for, and the
 * list exists to keep executables out, not to curate formats.
 */
export const DOCUMENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'text/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-tar',
  'application/json',
  'application/rtf',
  'application/postscript',
] as const;

/** True when `mimetype` satisfies one of the allow entries. */
export function isAllowedMimeType(
  mimetype: string,
  allow?: readonly string[],
): boolean {
  // No list means no restriction. Callers that want everything say so by
  // omitting it, rather than by passing a list that has to stay exhaustive.
  if (!allow || allow.length === 0) return true;
  return allow.some((entry) =>
    entry.endsWith('/') ? mimetype.startsWith(entry) : mimetype === entry,
  );
}

/**
 * Build multer options for an upload route.
 *
 * One factory instead of a file per shape. There were two hardcoded option
 * objects before, and a third kind of upload meant a third file that would
 * drift from the other two.
 */
export function uploadOptions(rules: UploadRules): MulterOptions {
  return {
    limits: { fileSize: rules.maxSizeMb * MB },
    fileFilter: (_req, file, callback) => {
      if (!isAllowedMimeType(file.mimetype, rules.allow)) {
        callback(
          // Names the type that was refused. "Unsupported file type" alone
          // leaves the user guessing which of five files was the problem.
          new BadRequestException(`Unsupported file type: ${file.mimetype}`),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

/**
 * The avatar size cap, in megabytes.
 *
 * Exported because the account screen quotes it in copy ("Pick a photo up to
 * 5MB") and `GET /profiles/options` serves it from here. A number typed into a
 * sentence in a browser is a promise nobody checks against the multer limit that
 * actually enforces it, and the two drift the first time either moves.
 */
export const AVATAR_MAX_SIZE_MB = 5;

/** A single image, for avatars. */
export const imageUploadOptions = uploadOptions({
  maxSizeMb: AVATAR_MAX_SIZE_MB,
  allow: IMAGE_TYPES,
});

/** Project documents: bigger, and almost any format. */
export const documentUploadOptions = uploadOptions({
  maxSizeMb: 25,
  allow: DOCUMENT_TYPES,
});

/**
 * No type restriction at all, for a route that genuinely accepts anything.
 *
 * Unused today, and exported because a caller reaching for it should find it
 * rather than hand-roll a filter that accidentally allows executables where the
 * other two do not.
 */
export const anyFileUploadOptions = uploadOptions({ maxSizeMb: 25 });
