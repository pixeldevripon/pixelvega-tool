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
        return this.delete(publicId, resourceType).catch(() => undefined);
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
   * Delete one asset.
   *
   * `resourceType` must be the one the upload reported. Cloudinary partitions
   * its namespace by resource type, so destroying a video with the default
   * 'image' silently succeeds and deletes nothing, which is why
   * `UploadedAsset` carries it.
   */
  async delete(
    publicId: string,
    resourceType: string = 'image',
  ): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }

  /** Delete several, never throwing: a failed cleanup must not fail the action. */
  async deleteMany(
    assets: Array<{ publicId: string; resourceType?: string }>,
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
