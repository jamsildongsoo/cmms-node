import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportPowerGenerationDto } from './dto/power-generation.dto';
import { PowerGenerationService } from './power-generation.service';

@Controller('api/power-generation')
@UseGuards(JwtAuthGuard)
export class PowerGenerationController {
  constructor(private readonly service: PowerGenerationService) {}

  @Post('import')
  importDay(@Body() request: ImportPowerGenerationDto) {
    return this.service.importDay(request.tradingDay);
  }

  @Get('monthly')
  getMonthly(@Query('month') month: string) {
    return this.service.getMonthlySummary(month);
  }

  @Get('hourly')
  getHourly(@Query('day') day: string) {
    return this.service.getHourly(day);
  }
}
