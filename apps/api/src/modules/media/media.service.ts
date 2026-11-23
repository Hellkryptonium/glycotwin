import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { Database } from '../../config/database.js';
import { mediaAssets } from '../../db/schema/media-assets.js';
import type { BackblazeStorage } from '../../integration/backblaze/backblaze.client.js';

const idSchema = z.string().uuid();
const uploadSchema = z.object({
  purpose: z.enum(['PROFILE_PHOTO', 'AI_ATTACHMENT', 'CLINICAL_DOCUMENT']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  fileName: z.string().trim().min(1).max(255).optional(),
}).superRefine((value, context) => {
  if (value.purpose === 'PROFILE_PHOTO' && !value.contentType.startsWith('image/')) context.addIssue({ code: 'custom', message: 'Profile photos must be images.' });
  if (value.purpose === 'PROFILE_PHOTO' && value.sizeBytes > 5 * 1024 * 1024) context.addIssue({ code: 'custom', message: 'Profile photos must be 5 MB or smaller.' });
});
const inlineUploadSchema = uploadSchema.extend({ base64: z.string().min(4).max(7_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Image data is invalid.') });

const extensionFor = (contentType: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' })[contentType] ?? 'bin';

export function createMediaService(database: Database, storage: BackblazeStorage | null) {
  const requireStorage = () => {
    if (!storage) throw new AppError(503, 'MEDIA_DISABLED', 'Private file storage is not configured.');
    return storage;
  };
  const owned = async (ownerUserId: string, assetId: string) => {
    const rows = await database.select().from(mediaAssets).where(and(eq(mediaAssets.id, idSchema.parse(assetId)), eq(mediaAssets.ownerUserId, idSchema.parse(ownerUserId)))).limit(1);
    if (!rows[0]) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media asset was not found.');
    return rows[0];
  };
  return {
    async createUpload(ownerUserId: string, raw: unknown) {
      const input = uploadSchema.parse(raw);
      const trustedOwner = idSchema.parse(ownerUserId);
      const assetId = randomUUID();
      const key = `users/${trustedOwner}/${input.purpose.toLowerCase()}/${assetId}.${extensionFor(input.contentType)}`;
      const [asset] = await database.insert(mediaAssets).values({
        id: assetId, ownerUserId: trustedOwner, purpose: input.purpose, objectKey: key,
        contentType: input.contentType, sizeBytes: input.sizeBytes, originalFileName: input.fileName ?? null,
      }).returning();
      if (!asset) throw new Error('Media asset insert did not return a row.');
      return { asset, uploadUrl: await requireStorage().createUploadUrl(key, input.contentType, input.sizeBytes) };
    },
    async complete(ownerUserId: string, assetId: string) {
      const asset = await owned(ownerUserId, assetId);
      if (asset.status === 'READY') return asset;
      try {
        const object = await requireStorage().objectInfo(asset.objectKey);
        if (object.ContentLength !== asset.sizeBytes || object.ContentType?.split(';')[0] !== asset.contentType) {
          await database.update(mediaAssets).set({ status: 'REJECTED', updatedAt: new Date() }).where(eq(mediaAssets.id, asset.id));
          throw new AppError(400, 'MEDIA_VALIDATION_FAILED', 'The uploaded file did not match its declared type or size.');
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(400, 'MEDIA_UPLOAD_NOT_FOUND', 'Upload the file before completing it.');
      }
      const [ready] = await database.update(mediaAssets).set({ status: 'READY', updatedAt: new Date() }).where(eq(mediaAssets.id, asset.id)).returning();
      if (!ready) throw new Error('Media asset completion did not return a row.');
      return ready;
    },
    async uploadInline(ownerUserId: string, raw: unknown) {
      const input = inlineUploadSchema.parse(raw);
      const bytes = Buffer.from(input.base64, 'base64');
      if (bytes.byteLength !== input.sizeBytes) throw new AppError(400, 'MEDIA_VALIDATION_FAILED', 'The uploaded file did not match its declared size.');
      const created = await this.createUpload(ownerUserId, input);
      await requireStorage().putObject(created.asset.objectKey, created.asset.contentType, bytes);
      return this.complete(ownerUserId, created.asset.id);
    },
    async downloadUrl(ownerUserId: string, assetId: string) {
      const asset = await owned(ownerUserId, assetId);
      if (asset.status !== 'READY') throw new AppError(409, 'MEDIA_NOT_READY', 'This upload is not ready yet.');
      return { url: await requireStorage().createDownloadUrl(asset.objectKey), expiresInSeconds: 300 };
    },
    async requireReadyProfilePhoto(ownerUserId: string, assetId: string) {
      const asset = await owned(ownerUserId, assetId);
      if (asset.status !== 'READY' || asset.purpose !== 'PROFILE_PHOTO') throw new AppError(400, 'INVALID_PROFILE_PHOTO', 'Choose a completed profile photo upload.');
      return asset;
    },
    async verifyConnection() { return requireStorage().verifyConnection(); },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
