import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PowerGeneration } from '../../entities/power-generation.entity';
import { KpxMeterClient } from './kpx-meter.client';
import { PowerGenerationController } from './power-generation.controller';
import { PowerGenerationService } from './power-generation.service';

@Module({
  imports: [TypeOrmModule.forFeature([PowerGeneration])],
  controllers: [PowerGenerationController],
  providers: [PowerGenerationService, KpxMeterClient],
})
export class PowerGenerationModule {}
