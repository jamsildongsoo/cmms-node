import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SaveCommentDto {
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  boardId!: number | string;

  @IsNotEmpty()
  @IsString()
  content!: string;
}
