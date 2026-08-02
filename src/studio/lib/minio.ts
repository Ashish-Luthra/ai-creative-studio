/**
 * Minio / S3-compatible object storage client.
 * Uses the AWS SDK v3 with a custom endpoint so it works with self-hosted Minio.
 *
 * Required env vars:
 *   MINIO_ENDPOINT      e.g. "localhost" or "minio.example.com"
 *   MINIO_PORT          e.g. "9000"
 *   MINIO_USE_SSL       "true" | "false"
 *   MINIO_ACCESS_KEY
 *   MINIO_SECRET_KEY
 *   MINIO_BUCKET        e.g. "emailer-assets"
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'

const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost'
const port = parseInt(process.env.MINIO_PORT ?? '9000', 10)
const useSSL = process.env.MINIO_USE_SSL === 'true'
const bucket = process.env.MINIO_BUCKET ?? 'emailer-assets'

export const s3 = new S3Client({
  endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
  region: 'us-east-1',          // Minio ignores region but SDK requires it
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
  },
  forcePathStyle: true,          // required for Minio
})

/**
 * Upload a Buffer/Uint8Array to Minio and return the public URL.
 */
export async function uploadToMinio(
  data: Buffer,
  mimeType: string,
  folder = 'uploads',
): Promise<string> {
  const ext = mimeType.split('/')[1] ?? 'bin'
  const key = `${folder}/${nanoid()}.${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: mimeType,
      ACL: 'public-read',
    }),
  )

  return `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${bucket}/${key}`
}
