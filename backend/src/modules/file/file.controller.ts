import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Readable } from 'stream';
import { FileStorageService, UploadResponse, FileItemResponse } from './file-storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3_CLIENT, STORAGE_SETTINGS, StorageSettings } from './storage.config';

@Controller('api/files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(
    private readonly fileService: FileStorageService,
    @Inject(STORAGE_SETTINGS) private readonly settings: StorageSettings,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('refModule') refModule?: string,
    @Query('refNo') refNo?: string,
    @Query('groupNo') groupNoStr?: string,
  ): Promise<UploadResponse> {
    const groupNo = groupNoStr ? parseInt(groupNoStr, 10) : null;
    return this.fileService.upload(
      refModule ?? null,
      refNo ?? null,
      groupNo,
      files,
    );
  }

  @Get(':groupNo')
  async list(
    @Param('groupNo', ParseIntPipe) groupNo: number,
  ): Promise<FileItemResponse[]> {
    return this.fileService.list(groupNo);
  }

  @Get(':groupNo/:itemNo/download')
  async download(
    @Param('groupNo', ParseIntPipe) groupNo: number,
    @Param('itemNo', ParseIntPipe) itemNo: number,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, originalFileName, mimeType, fileSize } =
      await this.fileService.download(groupNo, itemNo);

    const encodedFileName = encodeURIComponent(originalFileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);

    if (stream && typeof (stream as any).pipe === 'function') {
      (stream as any).pipe(res);
    } else if (stream instanceof Readable) {
      stream.pipe(res);
    } else if (stream && (stream as any).transformToWebStream) {
      const nodeStream = Readable.fromWeb((stream as any).transformToWebStream());
      nodeStream.pipe(res);
    } else {
      res.end(stream);
    }
  }

  @Delete(':groupNo/:itemNo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('groupNo', ParseIntPipe) groupNo: number,
    @Param('itemNo', ParseIntPipe) itemNo: number,
  ): Promise<void> {
    await this.fileService.delete(groupNo, itemNo);
  }
}
