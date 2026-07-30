import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { BoardRepository } from './board.repository';
import { Board } from '../../entities/board.entity';
import { BoardComment } from '../../entities/board-comment.entity';
import { User } from '../../entities/users.entity';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule, TypeOrmModule.forFeature([Board, BoardComment, User])],
  controllers: [BoardController],
  providers: [BoardService, BoardRepository],
  exports: [BoardService],
})
export class BoardModule {}
