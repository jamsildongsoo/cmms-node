/* =========================================================================
   StorageConfig — S3 호환 Object Storage 공통 설정

   개발 MinIO와 운영 Lightsail Object Storage가 같은 파일 서비스 코드를
   사용하도록 공급자별 차이는 STORAGE_* 환경변수로만 관리한다.
   ========================================================================= */
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export interface StorageSettings {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  forcePathStyle: boolean;
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
    forcePathStyle: settings.forcePathStyle,
  });
}

export function loadStorageSettings(config: ConfigService): StorageSettings {
  return {
    endpoint: config.getOrThrow<string>('STORAGE_ENDPOINT'),
    region: config.get<string>('STORAGE_REGION', 'ap-southeast-1'),
    accessKey: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
    secretKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
    bucket: config.get<string>('STORAGE_BUCKET', 'cmms-node-attachments'),
    forcePathStyle:
      config.get<string>('STORAGE_FORCE_PATH_STYLE', 'false') === 'true',
    reconcileEnabled: config.get<string>('STORAGE_RECONCILE_ENABLED', 'false') === 'true',
    reconcileGraceHours: config.get<number>('STORAGE_RECONCILE_GRACE_HOURS', 24),
    reconcileCron: config.get<string>('STORAGE_RECONCILE_CRON', '0 0 4 * * *'),
  };
}

/** NestJS 모듈 토큰 */
export const STORAGE_SETTINGS = 'STORAGE_SETTINGS';
export const S3_CLIENT = 'S3_CLIENT';
