import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board } from '../../entities/board.entity';
import { BoardComment } from '../../entities/board-comment.entity';
import { User } from '../../entities/users.entity';

@Injectable()
export class BoardRepository {
  constructor(
    @InjectRepository(Board)
    private readonly boards: Repository<Board>,
    @InjectRepository(BoardComment)
    private readonly comments: Repository<BoardComment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findAll(companyId: string): Promise<Board[]> {
    return this.boards.find({
      where: { companyId, deleteYn: 'N' },
      relations: { creator: true },
      order: { noticeYn: 'DESC', createdAt: 'DESC' },
    });
  }

  findOne(companyId: string, id: number): Promise<Board | null> {
    return this.boards.findOne({
      where: { companyId, id, deleteYn: 'N' },
      relations: { creator: true },
    });
  }

  findComments(companyId: string, boardId: number): Promise<BoardComment[]> {
    return this.comments.find({
      where: { companyId, boardId },
      order: { commentNo: 'ASC' },
    });
  }

  findUser(companyId: string, id: string): Promise<User | null> {
    return this.users.findOne({
      where: { companyId, id, deleteYn: 'N' },
    });
  }
}
