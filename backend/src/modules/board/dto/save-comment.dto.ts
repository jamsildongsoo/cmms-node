import { IsNotEmpty, IsString } from 'class-validator';

export class SaveCommentDto {
  @IsNotEmpty()
  boardId!: number | string;

  @IsNotEmpty()
  @IsString()
  content!: string;
}
