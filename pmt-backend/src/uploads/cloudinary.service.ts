import 'dotenv/config';
import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiErrorResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Cloudinary's own resource types.
 *
 * `auto` is the default here and should stay it: Cloudinary then decides from
 * the bytes, so a video uploads as a video and a zip as a raw file without the
 * caller having to know. The previous wrapper only offered `image` and `raw`,
 * so every call site had to guess with `mimetype.startsWith('image/')` and a
 * video would have been stored as an undeliverable raw blob.
 */
export type CloudinaryResourceType = 'auto' | 'image' | 'video' | 'raw';

export interface UploadedAsset {
  url: string;
  publicId: string;
  /** What Cloudinary decided this was. Needed to delete it again. */
  resourceType: string;
  bytes: number;
  /** The detected extension, e.g. `pdf`. Absent for some raw uploads. */
  format?: string;
  /** Images and video only. */
  width?: number;
  height?: number;
  originalFilename: string;
}

export interface UploadOptions {
  /** Cloudinary folder, e.g. `pmt/project-documents`. */
  folder: string;
  /**
   * Overrides Cloudinary's own detection. Leave unset unless a caller has a
   * reason to force one, which is rare.
   */
  resourceType?: CloudinaryResourceType;
}

/** What `uploadMany` reports for one file when only some of a batch failed. */
export type UploadOutcome =
  | { ok: true; asset: UploadedAsset }
  | { ok: false; filename: string; error: string };

/**
 * File storage, for any kind of file.
 *
 * Not tied to any feature: avatars, project documents and anything later all
 * use it by passing a different folder. Every method takes an
 * `Express.Multer.File` rather than a bare buffer, because the filename and
 * mimetype are worth keeping and a buffer alone loses both.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /** Upload one file. */
  upload(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<UploadedAsset> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: options.resourceType ?? 'auto',
          // Keeps the uploaded name recognisable in the Cloudinary console
          // instead of a random id, which matters when someone has to go
          // looking for an asset by hand.
          use_filename: true,
          unique_filename: true,
        },
        (
          error?: UploadApiErrorResponse,
          result?: {
            secure_url: string;
            public_id: string;
            resource_type: string;
            bytes: number;
            format?: string;
            width?: number;
            height?: number;
            original_filename?: string;
          },
        ) => {
          if (error || !result) {
            reject(new Error(error?.message ?? 'Cloudinary upload failed'));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            bytes: result.bytes,
            format: result.format,
            width: result.width,
            height: result.height,
            originalFilename: result.original_filename ?? file.originalname,
          });
        },
      );
      stream.end(file.buffer);
    });
  }

  /**
   * Upload several files at once, all or nothing.
   *
   * Rejects if ANY file fails, after deleting the ones that already succeeded.
   * The alternative, keeping the partial set, leaves a caller holding some
   * assets and an error, with no way to tell which rows to write. Callers that
   * genuinely want a partial result should use `uploadManySettled`.
   */
  async uploadMany(
    files: Express.Multer.File[],
    options: UploadOptions,
  ): Promise<UploadedAsset[]> {
    const settled = await this.uploadManySettled(files, options);
    const failures = settled.filter((outcome) => !outcome.ok);

    if (failures.length === 0) {
      return settled.map(
        (outcome) => (outcome as { asset: UploadedAsset }).asset,
      );
    }

    // Roll back what did land, so a failed batch leaves nothing behind.
    const uploaded = settled.filter((outcome) => outcome.ok);
    await Promise.all(
      uploaded.map((outcome) => {
        const { publicId, resourceType } = (outcome as { asset: UploadedAsset })
          .asset;
        return this.delete(publicId, resourceType).catch((error: Error) =>
          // Logged, not swallowed. A rollback that fails leaves a paid-for
          // orphan in Cloudinary that nothing will ever reference, and the
          // only way anyone learns about it is this line.
          this.logger.error(
            `Rollback failed: ${publicId} (${resourceType}) is now orphaned in Cloudinary: ${error.message}`,
          ),
        );
      }),
    );

    const [first] = failures as Array<{ filename: string; error: string }>;
    throw new Error(
      `Upload failed for ${first.filename}: ${first.error}` +
        (failures.length > 1 ? ` (and ${failures.length - 1} more)` : ''),
    );
  }

  /**
   * Upload several files, reporting each independently.
   *
   * Uploads run concurrently: a batch of ten is one round trip's wall clock,
   * not ten. Nothing here throws, so a caller decides what a partial batch
   * means for its own domain.
   */
  uploadManySettled(
    files: Express.Multer.File[],
    options: UploadOptions,
  ): Promise<UploadOutcome[]> {
    return Promise.all(
      files.map((file) =>
        this.upload(file, options).then(
          (asset): UploadOutcome => ({ ok: true, asset }),
          (error: Error): UploadOutcome => {
            this.logger.warn(
              `Upload failed for ${file.originalname}: ${error.message}`,
            );
            return {
              ok: false,
              filename: file.originalname,
              error: error.message,
            };
          },
        ),
      ),
    );
  }

  /**
   * Delete one asset. Throws unless Cloudinary confirms it is gone.
   *
   * ── Why the result is inspected ──
   * `destroy` RESOLVES with `{ result: 'not found' }` for a publicId or
   * resourceType that does not match anything. It does not throw. Awaiting it
   * and discarding the answer therefore reported success for a delete that
   * removed nothing: the database row went, and the bytes stayed publicly
   * reachable at their URL forever, with no error anywhere.
   *
   * ── Why resourceType is required ──
   * Cloudinary partitions its namespace by resource type, so destroying a video
   * as an 'image' is exactly the silent no-op above. It has no default for the
   * same reason: `?? 'image'` at a call site recreates the bug, and
   * `UploadedAsset` carries the real value precisely so it can be passed here.
   */
  async delete(publicId: string, resourceType: string): Promise<void> {
    const response = (await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    })) as { result?: string };

    // 'ok' is a delete. 'not found' is the silent no-op. Anything else is new,
    // and treating an unrecognised answer as success is how this failed before.
    if (response.result !== 'ok') {
      throw new Error(
        `Cloudinary refused to delete ${publicId} (${resourceType}): ${response.result ?? 'no result'}`,
      );
    }
  }

  /**
   * Delete an asset whose resource type was never recorded.
   *
   * Only for rows written before `fileResourceType` existed. Cloudinary
   * partitions its namespace by resource type and offers no way to ask which
   * one an id belongs to, so each is tried in turn. That works only because
   * `delete` now throws on `not found`: with the old version this could not
   * have been written, since every attempt reported success.
   *
   * Never guess with `?? 'image'` instead. That is the silent no-op: the row
   * disappears and the bytes stay publicly reachable.
   *
   * It stops at the FIRST namespace that reports a delete, and does not verify
   * that what it deleted was the intended asset. That is safe only because
   * `upload` sets `unique_filename: true`, so Cloudinary appends a random
   * suffix and two independently uploaded assets cannot share a publicId across
   * namespaces. If that option is ever removed, this becomes a way to delete an
   * unrelated document's asset and must be revisited.
   */
  async deleteUnknownResourceType(publicId: string): Promise<void> {
    const errors: string[] = [];
    for (const resourceType of ['image', 'video', 'raw']) {
      try {
        await this.delete(publicId, resourceType);
        return;
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    throw new Error(
      `Could not delete ${publicId} as any resource type: ${errors.join('; ')}`,
    );
  }

  /** Delete several, never throwing: a failed cleanup must not fail the action. */
  async deleteMany(
    assets: Array<{ publicId: string; resourceType: string }>,
  ): Promise<void> {
    await Promise.all(
      assets.map((asset) =>
        this.delete(asset.publicId, asset.resourceType).catch((error: Error) =>
          this.logger.warn(
            `Failed to delete ${asset.publicId}: ${error.message}`,
          ),
        ),
      ),
    );
  }
}
