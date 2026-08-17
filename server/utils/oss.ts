import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeFileName } from "./filename";

function createS3Client() {
  const endpoint = process.env.OSS_ENDPOINT;
  const accessKeyId = process.env.OSS_ACCESS_KEY;
  const secretAccessKey = process.env.OSS_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("OSS 环境变量未配置完整");
  }

  return new S3Client({
    endpoint,
    region: process.env.OSS_REGION || "default",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function getBucket() {
  const bucket = process.env.OSS_BUCKET_NAME;
  if (!bucket) {
    throw new Error("OSS_BUCKET_NAME 未配置");
  }
  return bucket;
}

/**
 * 上传文件到私有存储桶，返回文件 Key
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const safeName = sanitizeFileName(fileName);
  const fileKey = `uploads/${Date.now()}-${safeName}`;
  const s3Client = createS3Client();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return fileKey;
}

/**
 * 校验存储 Key，仅允许 uploads/ 下的对象，防止路径穿越
 */
export function isValidFileKey(fileKey: string): boolean {
  if (!fileKey || typeof fileKey !== "string") return false;
  if (fileKey.includes("..") || fileKey.includes("\\") || fileKey.startsWith("/")) {
    return false;
  }
  return fileKey.startsWith("uploads/");
}

/**
 * 生成有效期 5 分钟的临时访问链接。
 * 注意：若 OSS_ENDPOINT 为集群内网地址，该链接浏览器无法直接访问，
 * 前端展示请走 /api/file 代理。
 */
export async function getSignedUrl(fileKey: string): Promise<string> {
  if (!isValidFileKey(fileKey)) {
    throw new Error("无效的 fileKey");
  }

  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: fileKey,
  });

  return s3GetSignedUrl(createS3Client(), command, { expiresIn: 300 });
}

/**
 * 从私有桶读取对象，供服务端代理给浏览器
 */
export async function getObject(fileKey: string) {
  if (!isValidFileKey(fileKey)) {
    throw new Error("无效的 fileKey");
  }

  return createS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
    })
  );
}
