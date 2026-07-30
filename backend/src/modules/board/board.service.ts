import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Board } from '../../entities/board.entity';
import { BoardComment } from '../../entities/board-comment.entity';
import { User } from '../../entities/users.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { AppModule } from '../../common/constants/module.constants';
import type { PermAction } from '../../common/constants/permission.constants';
import { BoardRepository } from './board.repository';
import {
  BoardCommentResponseDto,
  BoardDetailResponseDto,
  BoardResponseDto,
} from './dto/board-response.dto';
import { SaveBoardDto } from './dto/save-board.dto';
import { SaveCommentDto } from './dto/save-comment.dto';
import { FileStorageService } from '../file/file-storage.service';

@Injectable()
export class BoardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly boardRepository: BoardRepository,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async getBoards(companyId: string): Promise<BoardResponseDto[]> {
    return (await this.boardRepository.findAll(companyId)).map((board) =>
      this.toBoardResponse(board),
    );
  }

  async getBoardDetails(
    companyId: string,
    id: number,
  ): Promise<BoardDetailResponseDto> {
    const board = await this.boardRepository.findOne(companyId, id);
    if (!board) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    const comments = await this.boardRepository.findComments(companyId, id);
    return {
      board: this.toBoardResponse(board),
      comments: comments.map((comment) => this.toCommentResponse(comment)),
    };
  }

  async saveBoard(
    companyId: string,
    input: SaveBoardDto,
    operator: string,
    roleId: string,
  ): Promise<BoardResponseDto> {
    const repository = this.dataSource.getRepository(Board);
    const rawId = input.id == null ? null : Number(input.id);
    let entity: Board;
    if (rawId == null) {
      await this.assertPermission(companyId, roleId, 'C');
      entity = repository.create({
        companyId,
        boardTypeCode: input.boardTypeCode,
        title: input.title,
        content: input.content,
        noticeYn: input.noticeYn || 'N',
        fileGroupId: input.fileGroupId ?? null,
        refNo: input.refNo ?? null,
        refModule: input.refModule ?? null,
        createdBy: operator,
        updatedBy: operator,
        deleteYn: 'N',
      });
    } else {
      entity = await repository.findOne({
        where: { companyId, id: rawId, deleteYn: 'N' },
      }) ?? (() => {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      })();
      if (
        entity.createdBy !== operator
        && !(await this.hasPermission(companyId, roleId, 'U'))
      ) {
        throw new ForbiddenException(
          '본인 게시글이 아니거나 게시판 수정 권한이 없습니다.',
        );
      }
      Object.assign(entity, {
        boardTypeCode: input.boardTypeCode,
        title: input.title,
        content: input.content,
        noticeYn: input.noticeYn || 'N',
        fileGroupId: input.fileGroupId ?? null,
        refNo: input.refNo ?? null,
        refModule: input.refModule ?? null,
        updatedBy: operator,
      });
    }
    const saved = await repository.save(entity);
    if (saved.fileGroupId != null) {
      await this.fileStorageService.bindGroupToReference({
        companyId,
        groupNo: saved.fileGroupId,
        refModule: AppModule.BRD,
        refNo: String(saved.id),
        operatorId: operator,
      });
    }
    const responseEntity = await this.boardRepository.findOne(
      companyId,
      Number(saved.id),
    );
    if (!responseEntity) {
      throw new NotFoundException('저장된 게시글을 찾을 수 없습니다.');
    }
    return this.toBoardResponse(responseEntity);
  }

  async deleteBoard(
    companyId: string,
    id: number,
    operator: string,
    roleId: string,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(Board);
    const entity = await repository.findOne({
      where: { companyId, id, deleteYn: 'N' },
    });
    if (!entity) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (
      entity.createdBy !== operator
      && !(await this.hasPermission(companyId, roleId, 'D'))
    ) {
      throw new ForbiddenException(
        '본인 게시글이 아니거나 게시판 삭제 권한이 없습니다.',
      );
    }
    const fileGroupId = entity.fileGroupId;
    entity.deleteYn = 'Y';
    entity.updatedBy = operator;
    await repository.save(entity);
    await this.fileStorageService.deleteGroupByCompany(companyId, fileGroupId, operator);
  }

  async saveComment(
    companyId: string,
    input: SaveCommentDto,
    operatorId: string,
  ): Promise<BoardCommentResponseDto> {
    const boardId = Number(input.boardId);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const board = await runner.manager
        .getRepository(Board)
        .createQueryBuilder('board')
        .setLock('pessimistic_write')
        .where('board.companyId = :companyId', { companyId })
        .andWhere('board.id = :boardId', { boardId })
        .andWhere('board.deleteYn = :notDeleted', { notDeleted: 'N' })
        .getOne();
      if (!board) throw new NotFoundException('게시글을 찾을 수 없습니다.');

      const user = await runner.manager.getRepository(User).findOne({
        where: { companyId, id: operatorId, deleteYn: 'N' },
      });
      const repository = runner.manager.getRepository(BoardComment);
      const lastComment = await repository.findOne({
        where: { companyId, boardId },
        order: { commentNo: 'DESC' },
      });
      const comment = repository.create({
        companyId,
        boardId,
        commentNo: Number(lastComment?.commentNo ?? 0) + 1,
        authorId: operatorId,
        authorName: user?.name ?? operatorId,
        content: input.content,
      });
      const saved = await repository.save(comment);
      await runner.commitTransaction();
      return this.toCommentResponse(saved);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async deleteComment(
    companyId: string,
    boardId: number,
    commentNo: number,
    operatorId: string,
    roleId: string,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(BoardComment);
    const comment = await repository.findOne({
      where: { companyId, boardId, commentNo },
    });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (
      comment.authorId !== operatorId
      && !(await this.hasPermission(companyId, roleId, 'D'))
    ) {
      throw new ForbiddenException(
        '본인 댓글이 아니거나 게시판 삭제 권한이 없습니다.',
      );
    }
    await repository.remove(comment);
  }

  private async assertPermission(
    companyId: string,
    roleId: string,
    action: PermAction,
  ): Promise<void> {
    if (!(await this.hasPermission(companyId, roleId, action))) {
      throw new ForbiddenException(`게시판 ${action} 권한이 없습니다.`);
    }
  }

  private async hasPermission(
    companyId: string,
    roleId: string,
    action: PermAction,
  ): Promise<boolean> {
    if (companyId === 'SYSTEM' && roleId.toUpperCase() === 'SYSTEM') {
      return true;
    }
    const permission = await this.dataSource.getRepository(RoleDetail).findOne({
      where: {
        companyId,
        roleId,
        moduleDetail: AppModule.BRD,
      },
    });
    if (!permission) return false;
    const property: Record<PermAction, keyof RoleDetail> = {
      C: 'permC',
      R: 'permR',
      U: 'permU',
      D: 'permD',
      A: 'permA',
    };
    return permission[property[action]] === 'Y';
  }

  private toBoardResponse(entity: Board): BoardResponseDto {
    return {
      id: Number(entity.id),
      boardTypeCode: entity.boardTypeCode,
      title: entity.title,
      content: entity.content,
      noticeYn: entity.noticeYn,
      fileGroupId:
        entity.fileGroupId == null ? null : Number(entity.fileGroupId),
      refNo: entity.refNo,
      refModule: entity.refModule,
      createdAt: entity.createdAt.toISOString(),
      createdBy: entity.createdBy,
      createdByName: entity.creator?.name ?? null,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toCommentResponse(
    entity: BoardComment,
  ): BoardCommentResponseDto {
    return {
      boardId: Number(entity.boardId),
      commentNo: Number(entity.commentNo),
      authorId: entity.authorId,
      authorName: entity.authorName,
      content: entity.content,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
