/**
 * S3 버킷 퍼블릭 읽기 정책 + CORS 설정 스크립트
 * 실행: node s3-config/apply-s3-config.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  S3Client,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  DeletePublicAccessBlockCommand,
} from '@aws-sdk/client-s3';

// .env 파일 수동 파싱 (dotenv 없이)
const envPath = new URL('../.env', import.meta.url);
const envContent = readFileSync(fileURLToPath(envPath), 'utf-8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      return [key, val];
    })
);

const REGION = env.AWS_REGION;
const BUCKET = env.S3_BUCKET;

if (!REGION || !BUCKET) {
  console.error('AWS_REGION 또는 S3_BUCKET이 .env에 없습니다.');
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'PublicReadForGameAndThumbnailFiles',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: [
        `arn:aws:s3:::${BUCKET}/games/*`,
        `arn:aws:s3:::${BUCKET}/thumbnails/*`,
      ],
    },
  ],
};

const corsConfig = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'HEAD'],
      AllowedOrigins: ['*'],
      ExposeHeaders: ['Content-Length', 'Content-Type'],
      MaxAgeSeconds: 3000,
    },
  ],
};

async function apply() {
  console.log(`버킷: ${BUCKET} (${REGION})`);

  // 1. 퍼블릭 액세스 차단 해제
  console.log('\n[1/3] 퍼블릭 액세스 차단 해제 중...');
  await s3.send(
    new DeletePublicAccessBlockCommand({ Bucket: BUCKET })
  );
  console.log('     완료');

  // 2. 버킷 정책 적용
  console.log('[2/3] 버킷 정책(games/*, thumbnails/* 공개 읽기) 적용 중...');
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify(bucketPolicy),
    })
  );
  console.log('     완료');

  // 3. CORS 설정
  console.log('[3/3] CORS 설정 적용 중...');
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: corsConfig,
    })
  );
  console.log('     완료');

  console.log('\nS3 설정이 완료되었습니다.');
  console.log(`게임 파일 URL 예시: https://${BUCKET}.s3.${REGION}.amazonaws.com/games/1/1.0.0/index.html`);
}

apply().catch((err) => {
  console.error('오류:', err.message);
  process.exit(1);
});
