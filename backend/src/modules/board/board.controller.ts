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
import { PermissionGuard, ModuleAccess } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/board')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  @ModuleAccess(AppModule.BRD)
  async getBoards(): Promise<BoardResponseDto[]> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoards(companyId);
  }

  @Get(':id')
  @ModuleAccess(AppModule.BRD)
  async getBoardDetails(@Param('id', ParseIntPipe) id: number): Promise<BoardDetailResponseDto> {
    const { companyId } = getTenantContext();
    return this.boardService.getBoardDetails(companyId, id);
  }

  @Post()
  @ModuleAccess(AppModule.BRD)
  async saveBoard(@Body() board: SaveBoardDto): Promise<BoardResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.boardService.saveBoard(companyId, board, userId, roleId);
  }

  @Put(':id')
  @ModuleAccess(AppModule.BRD)
  async updateBoard(@Param('id', ParseIntPipe) id: number, @Body() board: SaveBoardDto): Promise<BoardResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    board.id = id;
    return this.boardService.saveBoard(companyId, board, userId, roleId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModuleAccess(AppModule.BRD)
  async deleteBoard(@Param('id', ParseIntPipe) id: number): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.boardService.deleteBoard(companyId, id, userId, roleId);
  }

  @Post(':id/comments')
  @ModuleAccess(AppModule.BRD)
  async saveComment(@Param('id', ParseIntPipe) boardId: number, @Body() comment: SaveCommentDto): Promise<BoardCommentResponseDto> {
    const { companyId, userId } = getTenantContext();
    comment.boardId = boardId;
    return this.boardService.saveComment(companyId, comment, userId);
  }

  @Delete(':id/comments/:commentNo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModuleAccess(AppModule.BRD)
  async deleteComment(@Param('id', ParseIntPipe) boardId: number, @Param('commentNo', ParseIntPipe) commentNo: number): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.boardService.deleteComment(companyId, boardId, commentNo, userId, roleId);
  }
}

