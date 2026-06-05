import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { BoardService, BoardDetailResponse } from './board.service';
import { SaveBoardDto } from './dto/save-board.dto';
import { SaveCommentDto } from './dto/save-comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/board')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  @Permission(AppModule.BRD, 'R')
  async getBoards(): Promise<any[]> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoards(companyId);
  }

  @Get(':id/details')
  @Permission(AppModule.BRD, 'R')
  async getBoardDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BoardDetailResponse> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoardDetails(companyId, id);
  }

  @Post()
  @Permission(AppModule.BRD, 'C')
  async saveBoard(@Body() board: SaveBoardDto): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.boardService.saveBoard(companyId, board, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.BRD, 'D')
  async deleteBoard(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.boardService.deleteBoard(companyId, id, userId);
  }

  @Post('comment')
  @Permission(AppModule.BRD, 'C')
  async saveComment(@Body() comment: SaveCommentDto): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.boardService.saveComment(companyId, comment, userId);
  }

  @Delete('comment')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.BRD, 'D')
  async deleteComment(
    @Query('boardId', ParseIntPipe) boardId: number,
    @Query('commentNo', ParseIntPipe) commentNo: number,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.boardService.deleteComment(companyId, boardId, commentNo, userId);
  }
}
