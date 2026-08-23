import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/board')
@UseGuards(JwtAuthGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  async getBoards(): Promise<BoardResponseDto[]> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoards(companyId);
  }

  @Get(':id')
  async getBoardDetails(@Param('id', ParseIntPipe) id: number): Promise<BoardDetailResponseDto> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoardDetails(companyId, id);
  }

  @Post()
  async saveBoard(@Body() board: SaveBoardDto): Promise<BoardResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.boardService.saveBoard(companyId, null, board, userId);
  }

  @Put(':id')
  async updateBoard(@Param('id', ParseIntPipe) id: number, @Body() board: SaveBoardDto): Promise<BoardResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.boardService.saveBoard(companyId, id, board, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBoard(@Param('id', ParseIntPipe) id: number): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.boardService.deleteBoard(companyId, id, userId);
  }

  @Post(':id/comments')
  async saveComment(@Param('id', ParseIntPipe) boardId: number, @Body() comment: SaveCommentDto): Promise<BoardCommentResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.boardService.saveComment(companyId, boardId, comment, userId);
  }

  @Delete(':id/comments/:commentNo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Param('id', ParseIntPipe) boardId: number, @Param('commentNo', ParseIntPipe) commentNo: number): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.boardService.deleteComment(companyId, boardId, commentNo, userId);
  }
}
