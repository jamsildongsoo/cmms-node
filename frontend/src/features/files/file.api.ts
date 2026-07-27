import type { AxiosProgressEvent } from 'axios';
import axiosInstance from '../../api/axios';
import type {
  FileItem,
  FileUploadPolicy,
  FileUploadRequest,
  FileUploadResponse,
} from './file.types';

let policyRequest: Promise<FileUploadPolicy> | null = null;

export const fileApi = {
  getPolicy(): Promise<FileUploadPolicy> {
    if (!policyRequest) {
      policyRequest = axiosInstance
        .get<FileUploadPolicy>('/files/policy')
        .then((response) => response.data)
        .catch((error) => {
          policyRequest = null;
          throw error;
        });
    }
    return policyRequest;
  },

  async getItems(groupNo: number): Promise<FileItem[]> {
    const response = await axiosInstance.get<FileItem[]>(`/files/${groupNo}`);
    return response.data;
  },

  async upload(
    request: FileUploadRequest,
    onUploadProgress?: (event: AxiosProgressEvent) => void,
  ): Promise<FileUploadResponse> {
    const form = new FormData();
    request.files.forEach((file) => form.append('files', file));
    if (request.groupNo) form.append('groupNo', String(request.groupNo));

    const params = new URLSearchParams({
      refModule: request.refModule,
    });
    if (request.groupNo) params.set('groupNo', String(request.groupNo));

    const response = await axiosInstance.post<FileUploadResponse>(
      `/files?${params.toString()}`,
      form,
      { onUploadProgress },
    );
    return response.data;
  },

  async download(groupNo: number, itemNo: number): Promise<Blob> {
    const response = await axiosInstance.get(
      `/files/${groupNo}/${itemNo}/download`,
      { responseType: 'blob' },
    );
    return new Blob([response.data]);
  },

  async remove(groupNo: number, itemNo: number): Promise<void> {
    await axiosInstance.delete(`/files/${groupNo}/${itemNo}`);
  },
};

