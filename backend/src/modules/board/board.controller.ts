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
import { BoardService } from './board.service';
import {
  BoardCommentResponseDto,
  BoardDetailResponseDto,
  BoardResponseDto,
} from './dto/board-response.dto';
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
  async getBoards(): Promise<BoardResponseDto[]> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoards(companyId);
  }

  @Get(':id/details')
  @Permission(AppModule.BRD, 'R')
  async getBoardDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BoardDetailResponseDto> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoardDetails(companyId, id);
  }

  @Post()
  async saveBoard(@Body() board: SaveBoardDto): Promise<BoardResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.boardService.saveBoard(companyId, board, userId, roleId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBoard(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.boardService.deleteBoard(companyId, id, userId, roleId);
  }

  @Post('comment')
  @Permission(AppModule.BRD, 'C')
  async saveComment(
    @Body() comment: SaveCommentDto,
  ): Promise<BoardCommentResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.boardService.saveComment(companyId, comment, userId);
  }

  @Delete('comment')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Query('boardId', ParseIntPipe) boardId: number,
    @Query('commentNo', ParseIntPipe) commentNo: number,
  ): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.boardService.deleteComment(
      companyId,
      boardId,
      commentNo,
      userId,
      roleId,
    );
  }
}
