import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiErrorResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadedAsset {
  url: string;
  publicId: string;
}

// This is Cloudinary's own resource_type. 'image' unlocks image transforms;
// 'raw' is required for anything else (pdf, docx, zip, ...).
export type CloudinaryResourceType = 'image' | 'raw';

// Generic file storage wrapper, not tied to any one feature. Profiles use
// it for avatars ('image'); project documents reuse it for both image and
// other uploads by passing a different `folder`/`resourceType`.
@Injectable()
export class CloudinaryService {
  upload(
    buffer: Buffer,
    folder: string,
    resourceType: CloudinaryResourceType = 'image',
  ): Promise<UploadedAsset> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (
          error?: UploadApiErrorResponse,
          result?: { secure_url: string; public_id: string },
        ) => {
          if (error || !result) {
            reject(new Error(error?.message ?? 'Cloudinary upload failed'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  async delete(
    publicId: string,
    resourceType: CloudinaryResourceType = 'image',
  ): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
