import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5, { message: '회사 코드는 최대 5자까지 입력할 수 있습니다.' })
  @Matches(/^[A-Za-z0-9]+$/, { message: '회사 코드는 영문자와 숫자만 사용할 수 있습니다.' })
  id!: string;
  @IsNotEmpty() @IsString() name!: string;
  @IsOptional() @IsString() businessNumber?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsNotEmpty() @IsString() adminId!: string;
  @IsNotEmpty() @IsString() adminName!: string;
  @IsNotEmpty() @IsString() @MinLength(8) adminPassword!: string;
}

export class CreateCompanyResponseDto {
  success!: boolean;
  companyId!: string;
  adminId!: string;
}
