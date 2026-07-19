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
  allowedMimes: string[];
  reconcileEnabled: boolean;
  reconcileGraceHours: number;
  reconcileCron: string;
  maxFileSizeBytes: number;
  maxFileCount: number;
}

export function createS3Client(settings: StorageSettings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKey,
      secretAccessKey: settings.secretKey,
    },
    // Spring: S3Configuration.builder().pathStyleAccessEnabled(true)
    // Supabase Storage S3 호환 필수 설정
    forcePathStyle: true,
  });
}

export function loadStorageSettings(config: ConfigService): StorageSettings {
  const maxFileSizeMB = config.get<number>('FILE_MAX_SIZE_MB', 100); // nginx client_max_body_size와 일치

  const allowedMimesRaw = config.get<string>(
    'STORAGE_ALLOWED_MIMES',
    'image/*,' +
    'application/pdf,' +
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
    'application/vnd.ms-excel,' +
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
    'application/msword,' +
    'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
    'application/vnd.ms-powerpoint,' +
    'application/x-hwp,application/vnd.hancom.hwp,application/haansofthwp,' +
    'application/hwp+zip,application/vnd.hancom.hwpx,application/octet-stream,' +
    'application/zip,application/x-zip-compressed',
  );

  return {
    endpoint: config.getOrThrow<string>('STORAGE_ENDPOINT'),
    region: config.get<string>('STORAGE_REGION', 'ap-southeast-1'),
    accessKey: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
    secretKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
    bucket: config.get<string>('STORAGE_BUCKET', 'cmms-attachments'),
    allowedMimes: allowedMimesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    reconcileEnabled: config.get<string>('STORAGE_RECONCILE_ENABLED', 'false') === 'true',
    reconcileGraceHours: config.get<number>('STORAGE_RECONCILE_GRACE_HOURS', 24),
    reconcileCron: config.get<string>('STORAGE_RECONCILE_CRON', '0 0 4 * * *'),
    maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    maxFileCount: config.get<number>('FILE_MAX_COUNT', 10),
  };
}

/** NestJS 모듈 토큰 */
export const STORAGE_SETTINGS = 'STORAGE_SETTINGS';
export const S3_CLIENT = 'S3_CLIENT';
