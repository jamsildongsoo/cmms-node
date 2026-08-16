import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsOptional, IsIn, IsObject, Min } from 'class-validator';
import { AppModule } from '../../../common/constants/module.constants';

export class SaveBoardDto {
  @IsOptional()
  @Transform(({ value }) => value === null || value === undefined || value === '' ? value : Number(value))
  @IsInt()
  @Min(1)
  id?: number | string | null;

  @IsNotEmpty()
  @IsString()
  boardTypeCode!: string;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  noticeYn?: string;

  @IsOptional()
  @Transform(({ value }) => value === null || value === undefined || value === '' ? value : Number(value))
  @IsInt()
  @Min(1)
  fileGroupId?: number | string | null;

  @IsOptional()
  @IsString()
  refNo?: string | null;

  @IsOptional()
  @IsIn(Object.values(AppModule))
  refModule?: string | null;
}
