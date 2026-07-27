import axiosInstance from '../../api/axios';
import type {
  BoardComment,
  BoardDetail,
  BoardPost,
  SaveBoardCommentRequest,
  SaveBoardRequest,
} from './board.types';

export const boardApi = {
  async getPosts(): Promise<BoardPost[]> {
    const response = await axiosInstance.get<BoardPost[]>('/board');
    return response.data;
  },

  async getDetail(boardId: number): Promise<BoardDetail> {
    const response = await axiosInstance.get<BoardDetail>(
      `/board/${boardId}`,
    );
    return response.data;
  },

  async savePost(request: SaveBoardRequest): Promise<BoardPost> {
    const response = request.id == null
      ? await axiosInstance.post<BoardPost>('/board', request)
      : await axiosInstance.put<BoardPost>(`/board/${request.id}`, request);
    return response.data;
  },

  async deletePost(boardId: number): Promise<void> {
    await axiosInstance.delete(`/board/${boardId}`);
  },

  async saveComment(
    request: SaveBoardCommentRequest,
  ): Promise<BoardComment> {
    const response = await axiosInstance.post<BoardComment>(
      `/board/${request.boardId}/comments`,
      request,
    );
    return response.data;
  },

  async deleteComment(boardId: number, commentNo: number): Promise<void> {
    await axiosInstance.delete(`/board/${boardId}/comments/${commentNo}`);
  },
};
