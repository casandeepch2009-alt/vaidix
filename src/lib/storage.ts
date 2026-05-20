// ════════════════════════════════════════════════════════════════════════════
// S3 / MinIO Storage Client
// ════════════════════════════════════════════════════════════════════════════
// Local dev: MinIO at localhost:9000. Production: AWS S3 / GCS (same API).
// Pre-signed URLs used for uploads + playback (CloudFront cookies in prod).

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

const globalForS3 = globalThis as unknown as { s3?: S3Client; s3public?: S3Client };

// Server-side client — uses the internal Docker hostname (e.g. http://minio:9000).
// Never put presigned URLs from this client in responses the browser will use directly.
export const s3 =
  globalForS3.s3 ??
  new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true,          // required for MinIO
    // Insurance against AWS SDK ≥3.729 default flip — sends x-amz-checksum-*
    // headers some S3-compatible servers reject. Diagnostic ruled it out as
    // root cause here (PutObject works either way), but cheap to pin.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

// Browser-facing client — signs presigned URLs against the PUBLIC endpoint
// (e.g. https://s3.vaidix.lvpei.org) so browsers can actually reach the URL.
// Defaults to the internal client when S3_PUBLIC_ENDPOINT is not set (local dev).
const publicEndpoint = env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT;
export const s3public =
  globalForS3.s3public ??
  new S3Client({
    endpoint: publicEndpoint,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForS3.s3 = s3;
  globalForS3.s3public = s3public;
}

export const BUCKET = env.S3_BUCKET;

// Process-lifetime guard. MinIO does not implement PutBucketCors and returns
// 501 NotImplemented; calling it per-upload threw before the file ever
// transferred. One-shot + try/catch makes the upload path resilient.
let bucketEnsured = false;

export async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [{
          AllowedHeaders: ['*'],
          AllowedMethods: ['PUT', 'GET', 'HEAD'],
          AllowedOrigins: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600,
        }],
      },
    }));
  } catch (err) {
    // CORS-setting can 501 on some S3-compatible servers — don't block uploads.
    // Presigned-URL CORS for browser uploads is configured at infra level.
    console.warn('[storage] PutBucketCors skipped:', (err as Error).message);
  }
  bucketEnsured = true;
}

export async function presignUpload(
  key: string,
  contentType: string,
  ttlSeconds = 900
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  // Use the public client so the signed URL hostname is reachable by browsers.
  return getSignedUrl(s3public, cmd, { expiresIn: ttlSeconds });
}

export async function presignDownload(key: string, ttlSeconds = 900): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  // Use the public client so the download URL is reachable by browsers.
  return getSignedUrl(s3public, cmd, { expiresIn: ttlSeconds });
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
