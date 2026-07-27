import type { AppModule } from '../../constants/module';

export interface FileItem {
  itemNo: number;
  originalFileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number;
}

export interface FileUploadPolicy {
  maxFileSizeBytes: number;
  maxFileCount: number;
  allowedMimeTypes: string[];
}

export interface FileUploadRequest {
  files: File[];
  refModule: AppModule;
  groupNo: number | null;
}

export interface FileUploadResponse {
  groupNo: number;
}

