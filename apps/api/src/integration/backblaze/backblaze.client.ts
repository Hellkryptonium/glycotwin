import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Environment } from '../../config/env.js';

const PRESIGNED_UPLOAD_SECONDS = 10 * 60;
const PRESIGNED_DOWNLOAD_SECONDS = 5 * 60;

function configured(environment: Environment) {
  return Boolean(environment.B2_BUCKET && environment.B2_ENDPOINT && environment.B2_KEY_ID && environment.B2_APPLICATION_KEY);
}

function regionFor(endpoint: string) {
  const match = new URL(endpoint).hostname.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i);
  return match?.[1] ?? 'us-east-1';
}

export class BackblazeStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(environment: Environment) {
    if (!configured(environment)) throw new Error('Backblaze B2 is not configured.');
    this.bucket = environment.B2_BUCKET!;
    this.client = new S3Client({
      endpoint: environment.B2_ENDPOINT!,
      region: regionFor(environment.B2_ENDPOINT!),
      credentials: { accessKeyId: environment.B2_KEY_ID!, secretAccessKey: environment.B2_APPLICATION_KEY! },
      forcePathStyle: true,
    });
  }

  async verifyConnection() {
    await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 }));
    return { bucket: this.bucket };
  }

  async createUploadUrl(key: string, contentType: string, sizeBytes: number) {
    return getSignedUrl(this.client, new PutObjectCommand({
      Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes,
    }), { expiresIn: PRESIGNED_UPLOAD_SECONDS });
  }

  async createDownloadUrl(key: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: PRESIGNED_DOWNLOAD_SECONDS });
  }

  async objectInfo(key: string) {
    return this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async putObject(key: string, contentType: string, body: Uint8Array) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: body.byteLength, Body: body }));
  }
}

export function createBackblazeStorage(environment: Environment) {
  return configured(environment) ? new BackblazeStorage(environment) : null;
}
