import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FileUploadSettings {
  readonly maxFileSizeBytes: number;
  readonly maxFileCount: number;
  readonly allowedMimes: readonly string[];
}

export interface FileUploadPolicyResponse {
  maxFileSizeBytes: number;
  maxFileCount: number;
  allowedMimeTypes: string[];
}

export const FILE_UPLOAD_SETTINGS = 'FILE_UPLOAD_SETTINGS';

function parsePositiveInteger(config: ConfigService, key: string): number {
  const raw = config.getOrThrow<string>(key);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer: ${raw}`);
  }
  return value;
}

export function loadFileUploadSettings(config: ConfigService): FileUploadSettings {
  const maxFileSizeMb = parsePositiveInteger(config, 'FILE_MAX_SIZE_MB');
  const maxFileCount = parsePositiveInteger(config, 'FILE_MAX_COUNT');
  const allowedMimes = config
    .getOrThrow<string>('STORAGE_ALLOWED_MIMES')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowedMimes.length === 0) {
    throw new Error('STORAGE_ALLOWED_MIMES must contain at least one MIME type');
  }

  return Object.freeze({
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    maxFileCount,
    allowedMimes: Object.freeze([...new Set(allowedMimes)]),
  });
}

@Module({
  providers: [
    {
      provide: FILE_UPLOAD_SETTINGS,
      inject: [ConfigService],
      // .env는 애플리케이션 부팅 시 여기서 한 번만 읽고 검증한다.
      useFactory: loadFileUploadSettings,
    },
  ],
  exports: [FILE_UPLOAD_SETTINGS],
})
export class FileUploadConfigModule {}
