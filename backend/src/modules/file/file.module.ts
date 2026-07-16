import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileController } from './file.controller';
import { FileStorageService } from './file-storage.service';
import {
  S3_CLIENT,
  STORAGE_SETTINGS,
  createS3Client,
  loadStorageSettings,
} from './storage.config';

@Module({
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
