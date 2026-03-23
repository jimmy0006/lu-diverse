import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import AdmZip from 'adm-zip';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

export async function uploadGameZip(
  gameId: number,
  version: string,
  zipBuffer: Buffer
): Promise<string> {
  const prefix = `games/${gameId}/${version}/`;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const fileEntries = entries.filter((entry) => !entry.isDirectory);

  // zip 내 모든 파일이 동일한 최상위 폴더 아래에 있는지 확인
  // e.g. GameName/index.html, GameName/Build/... → 최상위 폴더 존재
  // e.g. index.html, Build/... → 최상위 폴더 없음
  const topComponents = new Set(
    fileEntries.map((e) => e.entryName.split('/')[0])
  );
  const hasTopLevelFolder =
    topComponents.size === 1 && fileEntries.every((e) => e.entryName.includes('/'));

  const toRelativePath = (entryName: string) =>
    hasTopLevelFolder ? entryName.replace(/^[^/]+\//, '') : entryName;

  await Promise.all(
    fileEntries.map(async (entry) => {
        const key = prefix + toRelativePath(entry.entryName);
        const contentType = getContentType(entry.entryName);
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: entry.getData(),
            ContentType: contentType,
          })
        );
      })
  );

  return prefix;
}

export async function uploadThumbnail(
  gameId: number,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.split('/')[1] || 'jpg';
  const key = `thumbnails/${gameId}.${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return key;
}

/**
 * games/* 와 thumbnails/* 는 S3 버킷 정책으로 공개 읽기 허용되어 있으므로
 * Presigned URL 대신 직접 공개 URL을 반환합니다.
 * (Presigned URL은 index.html 내 상대경로 리소스에 서명이 적용되지 않아 403이 발생)
 */
export function getPublicUrl(key: string): string {
  const region = process.env.AWS_REGION!;
  const bucket = BUCKET;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function deleteGameFiles(prefix: string): Promise<void> {
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  if (!listed.Contents?.length) return;

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: listed.Contents.map((obj) => ({ Key: obj.Key! })),
      },
    })
  );
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: 'text/html',
    js: 'application/javascript',
    wasm: 'application/wasm',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    json: 'application/json',
    data: 'application/octet-stream',
    unityweb: 'application/octet-stream',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}
