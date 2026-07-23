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
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Readable } from 'stream';
import { FileStorageService, UploadResponse, FileItemResponse } from './file-storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FILE_UPLOAD_SETTINGS,
  FileUploadPolicyResponse,
  FileUploadSettings,
} from './file-upload.config';

@Controller('api/files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(
    private readonly fileService: FileStorageService,
    @Inject(FILE_UPLOAD_SETTINGS) private readonly uploadSettings: FileUploadSettings,
  ) {}

  @Get('policy')
  getPolicy(): FileUploadPolicyResponse {
    return {
      maxFileSizeBytes: this.uploadSettings.maxFileSizeBytes,
      maxFileCount: this.uploadSettings.maxFileCount,
      allowedMimeTypes: [...this.uploadSettings.allowedMimes],
    };
  }

  @Post()
  // 크기와 개수는 FileModule의 Multer 설정이 컨트롤러 진입 전에 검사한다.
  // 컨트롤러는 동일한 FILE_UPLOAD_SETTINGS로 방어 검증과 MIME 검사를 수행한다.
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('refModule') refModule?: string,
    @Query('refNo') refNo?: string,
    @Query('groupNo') groupNoStr?: string,
  ): Promise<UploadResponse> {
    this.validateUpload(files);
    const groupNo = groupNoStr ? parseInt(groupNoStr, 10) : null;
    return this.fileService.upload(
      refModule ?? null,
      refNo ?? null,
      groupNo,
      files,
    );
  }

  private validateUpload(files: Express.Multer.File[]): void {
    if (!files?.length) {
      throw new BadRequestException('업로드할 파일이 없습니다.');
    }

    // Multer가 크기와 개수를 먼저 차단하지만, 라우팅/인터셉터 설정 변경 시에도
    // 정책이 우회되지 않도록 같은 FILE_UPLOAD_SETTINGS 객체로 다시 확인한다.
    if (files.length > this.uploadSettings.maxFileCount) {
      throw new BadRequestException(
        `파일은 한 번에 최대 ${this.uploadSettings.maxFileCount}개까지 업로드할 수 있습니다.`,
      );
    }

    for (const file of files) {
      if (!file.size) {
        throw new BadRequestException('빈 파일은 업로드할 수 없습니다.');
      }
      if (file.size > this.uploadSettings.maxFileSizeBytes) {
        throw new BadRequestException(
          `파일 크기는 ${this.uploadSettings.maxFileSizeBytes / 1024 / 1024}MB를 초과할 수 없습니다.`,
        );
      }
      if (!this.isMimeAllowed(file.mimetype)) {
        throw new BadRequestException(`허용되지 않는 파일 형식입니다: ${file.mimetype}`);
      }
    }
  }

  private isMimeAllowed(mime: string): boolean {
    const normalized = mime?.toLowerCase() ?? '';
    return this.uploadSettings.allowedMimes.some((pattern) => {
      if (pattern.endsWith('/*')) {
        return normalized.startsWith(pattern.slice(0, -1));
      }
      return normalized === pattern;
    });
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
