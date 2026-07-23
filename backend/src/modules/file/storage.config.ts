/* =========================================================================
   StorageConfig — Supabase Storage (S3 호환) 설정
   
   Spring StorageConfig.java 1:1 대응.
   기존 cmms-agy의 STORAGE_* 환경변수를 그대로 재활용.
   
   Supabase Storage S3 호환 접근:
   - endpoint: https://xxx.supabase.co/storage/v1/s3
   - forcePathStyle: true  (Spring: pathStyleAccessEnabled)
   - credentials: Supabase Storage S3 Access Key / Secret
   ========================================================================= */
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export interface StorageSettings {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  reconcileEnabled: boolean;
  reconcileGraceHours: number;
  reconcileCron: string;
}

export function createS3Client(settings: StorageSettings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKey,
      secretAccessKey: settings.secretKey,
    },
    // Supabase Storage S3 호환 필수 설정
    forcePathStyle: true,
    // Supabase S3 게이트웨이는 Supabase 프로젝트 region 기준으로 SigV4 서명 검증
    signingRegion: 'ap-south-1',
  });
}

export function loadStorageSettings(config: ConfigService): StorageSettings {
  return {
    endpoint: config.getOrThrow<string>('STORAGE_ENDPOINT'),
    region: config.get<string>('STORAGE_REGION', 'ap-southeast-1'),
    accessKey: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
    secretKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
    bucket: config.get<string>('STORAGE_BUCKET', 'cmms-node-attachments'),
    reconcileEnabled: config.get<string>('STORAGE_RECONCILE_ENABLED', 'false') === 'true',
    reconcileGraceHours: config.get<number>('STORAGE_RECONCILE_GRACE_HOURS', 24),
    reconcileCron: config.get<string>('STORAGE_RECONCILE_CRON', '0 0 4 * * *'),
  };
}

/** NestJS 모듈 토큰 */
export const STORAGE_SETTINGS = 'STORAGE_SETTINGS';
export const S3_CLIENT = 'S3_CLIENT';
