import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @IsNotEmpty() @IsString() id!: string;
  @IsNotEmpty() @IsString() name!: string;
  @IsOptional() @IsString() businessNumber?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsNotEmpty() @IsString() adminId!: string;
  @IsNotEmpty() @IsString() adminName!: string;
  @IsNotEmpty() @IsString() adminPassword!: string;
}

export class CreateCompanyResponseDto {
  success!: boolean;
  companyId!: string;
  adminId!: string;
}
