import type { AppModule } from '../../constants/module';
import type { RichTextDocument } from '../../types/richText';

export type YesNo = 'Y' | 'N';

export interface BoardPost {
  id: number;
  boardTypeCode: string;
  title: string;
  content: RichTextDocument;
  noticeYn: YesNo;
  fileGroupId: number | null;
  refNo: string | null;
  refModule: AppModule | null;
  createdAt: string;
  createdBy: string;
  createdByName: string | null;
  updatedAt: string;
}

export interface BoardComment {
  boardId: number;
  commentNo: number;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface BoardDetail {
  board: BoardPost;
  comments: BoardComment[];
}

export interface SaveBoardRequest {
  id: number | null;
  boardTypeCode: string;
  title: string;
  content: RichTextDocument;
  noticeYn: YesNo;
  fileGroupId: number | null;
}

export interface SaveBoardCommentRequest {
  boardId: number;
  content: string;
}

