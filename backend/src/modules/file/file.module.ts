import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileController } from './file.controller';
import { FileStorageService } from './file-storage.service';
import {
  S3_CLIENT,
  STORAGE_SETTINGS,
  createS3Client,
  loadStorageSettings,
} from './storage.config';
import {
  FILE_UPLOAD_SETTINGS,
  FileUploadConfigModule,
  FileUploadSettings,
} from './file-upload.config';

@Module({
  imports: [
    FileUploadConfigModule,
    MulterModule.registerAsync({
      imports: [FileUploadConfigModule],
      inject: [FILE_UPLOAD_SETTINGS],
      useFactory: (settings: FileUploadSettings) => ({
        storage: memoryStorage(),
        // Multer가 요청 본문을 메모리에 모두 적재하기 전에 크기와 개수를 조기 차단한다.
        limits: {
          fileSize: settings.maxFileSizeBytes,
          files: settings.maxFileCount,
        },
      }),
    }),
  ],
  controllers: [FileController],
  providers: [
    FileStorageService,
    {
      provide: STORAGE_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => loadStorageSettings(config),
    },
    {
      provide: S3_CLIENT,
      inject: [STORAGE_SETTINGS],
      useFactory: (settings) => createS3Client(settings),
    },
  ],
  exports: [FileStorageService],
})
export class FileModule {}
