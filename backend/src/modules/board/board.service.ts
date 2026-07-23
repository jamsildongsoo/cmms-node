import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface BoardDetailResponse {
  board: any;
  comments: any[];
}

interface BoardRow {
  id: string | number;
  board_type_code: string;
  title: string;
  content: Record<string, unknown>;
  notice_yn: string;
  file_group_id: string | number | null;
  ref_no: string | null;
  ref_module: string | null;
  created_at: string | Date;
  created_by: string;
  created_by_name?: string | null;
  updated_at: string | Date;
}

@Injectable()
export class BoardService {
  constructor(private readonly dataSource: DataSource) {}

  async getBoards(companyId: string): Promise<any[]> {
    const rows = await this.dataSource.query<BoardRow[]>(
      `SELECT b.*, u.name AS created_by_name
       FROM board b
       LEFT JOIN users u ON u.company_id = b.company_id AND u.id = b.created_by
       WHERE b.company_id = $1 AND b.delete_yn = 'N'
       ORDER BY b.notice_yn DESC, b.created_at DESC`,
      [companyId],
    );
    return rows.map((row) => this.toBoardResponse(row));
  }

  async getBoardDetails(companyId: string, id: number): Promise<BoardDetailResponse> {
    const boards = await this.dataSource.query<BoardRow[]>(
      `SELECT b.*, u.name AS created_by_name
       FROM board b
       LEFT JOIN users u ON u.company_id = b.company_id AND u.id = b.created_by
       WHERE b.company_id = $1 AND b.id = $2 AND b.delete_yn = 'N'`,
      [companyId, id],
    );
    if (!boards.length) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    const comments = await this.dataSource.query(
      `SELECT 
        comment_no as "commentNo",
        author_id as "authorId",
        author_name as "authorName",
        content,
        created_at as "createdAt"
      FROM board_comment 
      WHERE company_id = $1 AND board_id = $2 
      ORDER BY comment_no ASC`,
      [companyId, id],
    );

    return {
      board: this.toBoardResponse(boards[0]),
      comments,
    };
  }

  async saveBoard(companyId: string, board: any, operator: string): Promise<any> {
    const isNew = board.id === undefined || board.id === null;

    if (isNew) {
      const inserted = await this.dataSource.query(
        `INSERT INTO board 
          (company_id, board_type_code, title, content, notice_yn, file_group_id, ref_no, ref_module, created_by, updated_by, delete_yn)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 'N') RETURNING *`,
        [
          companyId, board.boardTypeCode, board.title, board.content,
          board.noticeYn || 'N', board.fileGroupId ?? null, board.refNo ?? null,
          board.refModule ?? null, operator
        ],
      );
      return this.toBoardResponse(inserted[0] as BoardRow);
    } else {
      await this.dataSource.query(
        `UPDATE board 
         SET board_type_code = $3, title = $4, content = $5, notice_yn = $6, file_group_id = $7, ref_no = $8, ref_module = $9, updated_by = $10
         WHERE company_id = $1 AND id = $2`,
        [
          companyId, board.id, board.boardTypeCode, board.title, board.content,
          board.noticeYn || 'N', board.fileGroupId ?? null, board.refNo ?? null,
          board.refModule ?? null, operator
        ],
      );

      const updated = await this.dataSource.query(
        `SELECT * FROM board WHERE company_id = $1 AND id = $2`,
        [companyId, board.id],
      );
      return this.toBoardResponse(updated[0] as BoardRow);
    }
  }

  private toBoardResponse(row: BoardRow): any {
    return {
      id: Number(row.id),
      boardTypeCode: row.board_type_code,
      title: row.title,
      content: row.content,
      noticeYn: row.notice_yn,
      fileGroupId: row.file_group_id == null ? null : Number(row.file_group_id),
      refNo: row.ref_no,
      refModule: row.ref_module,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by_name ?? null,
      updatedAt: row.updated_at,
    };
  }

  async deleteBoard(companyId: string, id: number, operator: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE board 
       SET delete_yn = 'Y', updated_by = $3 
       WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
      [companyId, id, operator],
    );
  }

  async saveComment(companyId: string, comment: any, operatorId: string): Promise<any> {
    const userRows = await this.dataSource.query(
      `SELECT name FROM users WHERE company_id = $1 AND id = $2`,
      [companyId, operatorId],
    );
    const authorName = userRows[0]?.name ?? operatorId;

    // comment_no는 MAX+1로 산출 — 동시 댓글이 같은 번호를 잡으면 PK 충돌 가능.
    // 소규모 사업장 + 댓글은 단순 코멘트 수준이라 경합 가능성이 사실상 없어 락/재시도를 두지 않는다.
    const inserted = await this.dataSource.query(
      `INSERT INTO board_comment
        (company_id, board_id, comment_no, author_id, author_name, content, created_at)
       VALUES (
         $1,
         $2,
         (SELECT COALESCE(MAX(comment_no), 0) + 1 FROM board_comment WHERE company_id = $1 AND board_id = $2),
         $3, 
         $4, 
         $5, 
         NOW()
       ) RETURNING board_id as "boardId", comment_no as "commentNo", author_id as "authorId", author_name as "authorName", content, created_at as "createdAt"`,
      [companyId, comment.boardId, operatorId, authorName, comment.content],
    );
    return inserted[0];
  }

  async deleteComment(companyId: string, boardId: number, commentNo: number, operatorId: string): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT author_id FROM board_comment WHERE company_id = $1 AND board_id = $2 AND comment_no = $3`,
      [companyId, boardId, commentNo],
    );
    if (!rows.length) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    // 작성자 본인만 삭제 가능 (BRD:D 권한이 있어도 타인 댓글은 불가)
    if (rows[0].author_id !== operatorId) {
      throw new ForbiddenException('본인이 작성한 댓글만 삭제할 수 있습니다.');
    }
    await this.dataSource.query(
      `DELETE FROM board_comment WHERE company_id = $1 AND board_id = $2 AND comment_no = $3`,
      [companyId, boardId, commentNo],
    );
  }
}
