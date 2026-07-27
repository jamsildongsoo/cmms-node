import { IsNotEmpty, Matches } from 'class-validator';

export class ImportPowerGenerationDto {
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'tradingDay는 YYYYMMDD 8자리여야 합니다.' })
  tradingDay!: string;
}
