import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { AppModule } from '../../../common/constants/module.constants';

export class SaveBoardDto {
  @IsOptional()
  id?: number | string | null;

  @IsNotEmpty()
  @IsString()
  boardTypeCode!: string;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  noticeYn?: string;

  @IsOptional()
  fileGroupId?: number | string | null;

  @IsOptional()
  @IsString()
  refNo?: string | null;

  @IsOptional()
  @IsIn(Object.values(AppModule))
  refModule?: string | null;
}
