import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
  const MAX_FILES = 500;
  const MAX_UNCOMPRESSED_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

  const prefix = `games/${gameId}/${version}/`;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const fileEntries = entries.filter((entry) => !entry.isDirectory);

  // zip-bomb 방어: 파일 수 제한
  if (fileEntries.length > MAX_FILES) {
    throw new Error(`zip 파일 내 파일 수가 ${MAX_FILES}개를 초과합니다.`);
  }

  // zip-bomb 방어: 압축 해제 후 총 크기 제한
  const totalUncompressed = fileEntries.reduce((sum, e) => sum + e.header.size, 0);
  if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
    throw new Error('압축 해제 후 크기가 3GB를 초과합니다.');
  }

  // 경로 순회 공격 차단: .. 또는 절대경로 포함 항목 거부
  for (const entry of fileEntries) {
    const normalized = entry.entryName.replace(/\\/g, '/');
    if (normalized.includes('../') || normalized.startsWith('/')) {
      throw new Error(`허용되지 않는 파일 경로: ${entry.entryName}`);
    }
  }

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

  // 순차 업로드로 메모리 사용 제한
  for (const entry of fileEntries) {
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
  }

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

/**
 * OS 빌드 파일(zip)을 그대로 S3에 업로드합니다.
 * WebGL과 달리 압축을 풀지 않고 단일 파일로 저장합니다.
 */
export async function uploadBuildFile(
  gameId: number,
  os: string,
  buffer: Buffer,
  originalFilename: string
): Promise<string> {
  const key = `builds/${gameId}/${os}/${originalFilename}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/zip',
      ContentDisposition: `attachment; filename="${originalFilename}"`,
    })
  );
  return key;
}

/**
 * 빌드 파일 다운로드용 Presigned URL을 생성합니다 (1시간 유효).
 * builds/* 는 공개 접근이 아닌 서명된 URL로만 접근합니다.
 */
export async function getPresignedDownloadUrl(key: string, filename: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 3600 }
  );
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
