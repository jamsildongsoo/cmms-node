import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id!: string;

  // 기존 계정 로그인을 막지 않도록 로그인 단계에서는 길이 정책을 재검증하지 않는다.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class SignUpRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}

export class PasswordChangeRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class UserUpdateRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}
