import * as Minio from "minio";

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "127.0.0.1",
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

export const UCON_MINIO_BUCKET =
  process.env.MINIO_BUCKET || "uconai-files";

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(UCON_MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(UCON_MINIO_BUCKET, "us-east-1");
    console.log(`[MinIO] Bucket created: ${UCON_MINIO_BUCKET}`);
  } else {
    console.log(`[MinIO] Bucket OK: ${UCON_MINIO_BUCKET}`);
  }
}
