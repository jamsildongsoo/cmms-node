export class BoardResponseDto {
  id!: number;
  boardTypeCode!: string;
  title!: string;
  content!: Record<string, unknown>;
  noticeYn!: string;
  fileGroupId!: number | null;
  refNo!: string | null;
  refModule!: string | null;
  createdAt!: string;
  createdBy!: string;
  createdByName!: string | null;
  updatedAt!: string;
}

export class BoardCommentResponseDto {
  boardId!: number;
  commentNo!: number;
  authorId!: string;
  authorName!: string;
  content!: string;
  createdAt!: string;
}

export class BoardDetailResponseDto {
  board!: BoardResponseDto;
  comments!: BoardCommentResponseDto[];
}
